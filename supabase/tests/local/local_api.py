#!/usr/bin/env python3
"""Local Supabase stand-in for testing the Zari admin against the real schema + RLS.

Serves the repo as static files and emulates the subset of Supabase used by the
site: PostgREST (select with embeds, filters, order, range, count, insert/update/
delete, rpc), GoTrue (password login, refresh, user, update password), Storage
(upload/delete under storage.objects RLS, public download). Every DB call runs
through psql as role anon/authenticated with request.jwt.claims set, exactly like
PostgREST, so RLS and function permission checks are the real ones.
TEST ONLY — never deploy this. See supabase/tests/README.md.
"""
import base64, hashlib, hmac, json, os, re, secrets, subprocess, sys, time, urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.environ.get('ZARI_TEST_FILES') or os.path.join(HERE, 'storage_files')
PORT = int(os.environ.get('PORT', '8936'))
SECRET = b'local-test-secret'
PSQL = ['psql', '-h', '127.0.0.1', '-p', '55432', '-U', 'postgres', '-d', 'zari', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
REFRESH = {}
IDENT = re.compile(r'^[a-z_][a-z0-9_]*$')

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def jwt(claims):
    h = b64u(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode()); p = b64u(json.dumps(claims).encode())
    s = b64u(hmac.new(SECRET, (h + '.' + p).encode(), hashlib.sha256).digest())
    return h + '.' + p + '.' + s
def verify(tok):
    try:
        h, p, s = tok.split('.')
        if not hmac.compare_digest(s, b64u(hmac.new(SECRET, (h + '.' + p).encode(), hashlib.sha256).digest())): return None
        c = json.loads(base64.urlsafe_b64decode(p + '=' * (-len(p) % 4)))
        if c.get('exp', 0) < time.time(): return None
        return c
    except Exception: return None
ANON = jwt({'role': 'anon', 'iss': 'local', 'exp': int(time.time()) + 86400 * 365})

def lit(v):
    if v is None: return 'null'
    return "'" + str(v).replace("'", "''") + "'"

class DbError(Exception):
    def __init__(self, code, msg, status=400): self.code, self.msg, self.status = code, msg, status

def run(sql, claims=None, role=None):
    pre = ''
    if role:
        pre = 'begin; set local role %s; set local request.jwt.claims = %s;\n' % (role, lit(json.dumps(claims or {'role': role})))
    full = pre + sql + (';\ncommit;' if role else ';')
    p = subprocess.run(PSQL, input=full, capture_output=True, text=True, env=dict(os.environ, LC_ALL='C'))
    if p.returncode != 0:
        err = p.stderr
        m = re.search(r'ERROR:\s+([0-9A-Z]{5}):\s+(.*)', err)
        code, msg = (m.group(1), m.group(2).strip()) if m else ('XX000', err.strip())
        status = 403 if code == '42501' else 404 if code == 'P0002' else 409 if code == '23505' else 400
        raise DbError(code, msg, status)
    return p.stdout.strip()

# ---------- schema metadata (FKs, function args) ----------
FK = None
def fks():
    global FK
    if FK is None:
        rows = run("""select coalesce(json_agg(json_build_object('child', c.conrelid::regclass::text, 'parent', c.confrelid::regclass::text,
          'ccol', (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1]),
          'pcol', (select attname from pg_attribute where attrelid=c.confrelid and attnum=c.confkey[1]))), '[]')
          from pg_constraint c where c.contype='f' and c.connamespace='public'::regnamespace""")
        FK = json.loads(rows)
    return FK
def strip(t): return t.replace('public.', '')

def split_top(s, sep=','):
    out, depth, cur = [], 0, ''
    for ch in s:
        if ch == '(': depth += 1
        if ch == ')': depth -= 1
        if ch == sep and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): out.append(cur)
    return [x.strip() for x in out if x.strip()]

def build_select(table, sel, alias):
    """Return SQL select-list for `table` aliased `alias`, handling embeds recursively."""
    parts, inner_filters = [], []
    for item in split_top(sel or '*'):
        m = re.match(r'^(\w+)(?:!(\w+))?\((.*)\)$', item, re.S)
        if not m:
            col = item.split(':')[-1].strip()
            if col == '*': parts.append(alias + '.*')
            elif IDENT.match(col): parts.append('%s.%s' % (alias, col))
            continue
        rel, hint, inner = m.group(1), m.group(2), m.group(3)
        sub = alias + '_' + rel
        f = fks()
        one_to_many = [x for x in f if strip(x['child']) == rel and strip(x['parent']) == table]
        many_to_one = [x for x in f if strip(x['child']) == table and strip(x['parent']) == rel]
        if many_to_one:
            k = many_to_one[0]
            q = '(select row_to_json(%s) from (select %s from public.%s %s where %s.%s = %s.%s) %s)' % (
                sub + 'r', build_select(rel, inner, sub), rel, sub, sub, k['pcol'], alias, k['ccol'], sub + 'r')
            if hint == 'inner': inner_filters.append('%s is not null' % q)
        elif one_to_many:
            k = one_to_many[0]
            q = "(select coalesce(json_agg(%s), '[]') from (select %s from public.%s %s where %s.%s = %s.%s) %s)" % (
                sub + 'r', build_select(rel, inner, sub), rel, sub, sub, k['ccol'], alias, k['pcol'], sub + 'r')
        else:
            raise DbError('PGRST200', 'no relationship %s -> %s' % (table, rel))
        parts.append('%s as %s' % (q, rel))
    return ', '.join(parts)

def cond(col, opval, alias):
    if not IDENT.match(col): raise DbError('PGRST100', 'bad column ' + col)
    neg = False
    if opval.startswith('not.'): neg, opval = True, opval[4:]
    op, _, val = opval.partition('.')
    c = '%s.%s' % (alias, col)
    if op in ('eq', 'neq', 'gt', 'gte', 'lt', 'lte'):
        sym = {'eq': '=', 'neq': '<>', 'gt': '>', 'gte': '>=', 'lt': '<', 'lte': '<='}[op]
        e = '%s %s %s' % (c, sym, lit(val))
    elif op in ('like', 'ilike'):
        e = '%s::text %s %s' % (c, 'ilike' if op == 'ilike' else 'like', lit(val.replace('*', '%')))
    elif op == 'is':
        e = '%s is %s' % (c, {'null': 'null', 'true': 'true', 'false': 'false'}[val])
    elif op == 'in':
        vals = [v.strip().strip('"') for v in val.strip('()').split(',') if v.strip()]
        e = '%s::text in (%s)' % (c, ', '.join(lit(v) for v in vals)) if vals else 'false'
    elif op == 'cs':
        vals = [v.strip().strip('"') for v in val.strip('{}').split(',') if v.strip()]
        e = "%s @> array[%s]::%s" % (c, ', '.join(lit(v) for v in vals), 'uuid[]' if col.endswith('_ids') else 'text[]')
    else:
        raise DbError('PGRST100', 'unsupported op ' + op)
    return ('not (%s)' % e) if neg else e

def embedded_exists(table, path, col, opval, alias):
    f = fks(); cur, cur_alias, joins = table, alias, []
    sql_from, conds = [], []
    for i, rel in enumerate(path):
        a = 'ex%d' % i
        one_to_many = [x for x in f if strip(x['child']) == rel and strip(x['parent']) == cur]
        many_to_one = [x for x in f if strip(x['child']) == cur and strip(x['parent']) == rel]
        if one_to_many: k = one_to_many[0]; conds.append('%s.%s = %s.%s' % (a, k['ccol'], cur_alias, k['pcol']))
        elif many_to_one: k = many_to_one[0]; conds.append('%s.%s = %s.%s' % (a, k['pcol'], cur_alias, k['ccol']))
        else: raise DbError('PGRST200', 'no relationship')
        sql_from.append('public.%s %s' % (rel, a)); cur, cur_alias = rel, a
    conds.append(cond(col, opval, cur_alias))
    return 'exists (select 1 from %s where %s)' % (', '.join(sql_from), ' and '.join(conds))

def order_by(params, alias):
    o = params.get('order', [None])[0]
    if not o: return ''
    out = []
    for item in o.split(','):
        bits = item.split('.')
        col = bits[0]
        if not IDENT.match(col): continue
        d = 'desc' if 'desc' in bits else 'asc'
        n = ' nulls last' if 'nullslast' in bits else ' nulls first' if 'nullsfirst' in bits else ''
        out.append('%s.%s %s%s' % (alias, col, d, n))
    return ' order by ' + ', '.join(out)

def fn_args(name):
    r = run("""select json_agg(json_build_object('n', n, 't', t)) from (
      select unnest(proargnames) n, unnest(string_to_array(oidvectortypes(proargtypes), ', ')) t from pg_proc
      where proname = %s and pronamespace = 'public'::regnamespace limit 50) x""" % lit(name))
    rr = run("select json_build_object('set', proretset, 'ret', prorettype::regtype::text) from pg_proc where proname = %s and pronamespace='public'::regnamespace limit 1" % lit(name))
    return json.loads(r or 'null') or [], json.loads(rr or 'null')

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=REPO, **k)
    def log_message(self, fmt, *args):
        if os.environ.get('QUIET'): return
        sys.stderr.write('%s %s\n' % (self.command, self.path[:160]))

    def send_json(self, status, body, headers=None):
        data = b'' if body is None else json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        for k, v in (headers or {}).items(): self.send_header(k, v)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(data)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n) if n else b''

    def claims(self):
        tok = (self.headers.get('Authorization') or '').replace('Bearer ', '')
        c = verify(tok) or {'role': 'anon'}
        return c, ('authenticated' if c.get('role') == 'authenticated' else 'anon')

    def route(self):
        u = urllib.parse.urlparse(self.path)
        try:
            if u.path == '/supabase-client.js': return self.client_js()
            if u.path.startswith('/rest/v1/'): return self.rest(u)
            if u.path.startswith('/auth/v1/'): return self.auth(u)
            if u.path.startswith('/storage/v1/'): return self.storage(u)
            if u.path.startswith('/functions/v1/'): return self.send_json(404, {'error': 'function not running locally'})
        except DbError as e:
            return self.send_json(e.status, {'code': e.code, 'message': e.msg, 'details': None, 'hint': None})
        if self.command in ('GET', 'HEAD'):
            return super().do_GET() if self.command == 'GET' else super().do_HEAD()
        self.send_json(404, {'error': 'not found'})

    do_GET = do_POST = do_PATCH = do_DELETE = do_PUT = do_HEAD = route
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def client_js(self):
        src = open(os.path.join(REPO, 'supabase-client.js')).read()
        src = re.sub(r"var SUPABASE_URL = '[^']*';", "var SUPABASE_URL = location.origin;", src)
        src = re.sub(r"var SUPABASE_ANON_KEY = '[^']*';", "var SUPABASE_ANON_KEY = '%s';" % ANON, src)
        data = src.encode()
        self.send_response(200); self.send_header('Content-Type', 'application/javascript'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)

    # ---------------- PostgREST ----------------
    def rest(self, u):
        name = u.path[len('/rest/v1/'):]
        params = urllib.parse.parse_qs(u.query, keep_blank_values=True)
        claims, role = self.claims()
        prefer = self.headers.get('Prefer') or ''
        single = 'vnd.pgrst.object' in (self.headers.get('Accept') or '')
        if name.startswith('rpc/'):
            fn = name[4:]
            if not IDENT.match(fn): raise DbError('PGRST202', 'bad fn')
            args = json.loads(self.body() or b'{}') if self.command == 'POST' else {k: v[0] for k, v in params.items()}
            sig, ret = fn_args(fn)
            if ret is None: raise DbError('PGRST202', 'Could not find the function %s' % fn, 404)
            j = lit(json.dumps(args))
            parts = []
            for a in sig:
                if a['n'] not in args: continue
                t = a['t']
                if t in ('jsonb', 'json'): parts.append('%s => (%s::jsonb -> %s)::%s' % (a['n'], j, lit(a['n']), t))
                elif t.endswith('[]'): parts.append("%s => array(select jsonb_array_elements_text(%s::jsonb -> %s))::%s" % (a['n'], j, lit(a['n']), t))
                else: parts.append('%s => (%s::jsonb ->> %s)::%s' % (a['n'], j, lit(a['n']), t))
            call = 'public.%s(%s)' % (fn, ', '.join(parts))
            sql = ("select coalesce(json_agg(x), '[]') from %s x" % call) if ret['set'] else ('select to_json(%s)' % call)
            out = run(sql, claims, role)
            return self.send_json(200, json.loads(out) if out else None)
        if not IDENT.match(name): raise DbError('PGRST205', 'bad table')
        alias = 't0'
        w = self.where_with_table(params, alias, name)
        if self.command in ('GET', 'HEAD'):
            sel = build_select(name, params.get('select', ['*'])[0], alias)
            base = 'select %s from public.%s %s where %s' % (sel, name, alias, w)
            lim = params.get('limit', [None])[0]; off = params.get('offset', [None])[0]
            rng = self.headers.get('Range')
            if rng and not lim:
                a, b = rng.split('-'); off, lim = a, str(int(b) - int(a) + 1)
            q = base + order_by(params, alias) + (' limit %d' % int(lim) if lim else '') + (' offset %d' % int(off) if off else '')
            want_count = 'count=exact' in prefer
            sql = "select json_build_object('rows', coalesce((select json_agg(r) from (%s) r), '[]'), 'count', %s)" % (
                q, '(select count(*) from public.%s %s where %s)' % (name, alias, w) if want_count else 'null')
            res = json.loads(run(sql, claims, role))
            rows, count = res['rows'], res['count']
            start = int(off or 0)
            hdr = {'Content-Range': '%s/%s' % (('%d-%d' % (start, start + len(rows) - 1)) if rows else '*', count if count is not None else '*')}
            if single:
                if len(rows) != 1: return self.send_json(406, {'code': 'PGRST116', 'message': 'JSON object requested, multiple (or no) rows returned', 'details': 'The result contains %d rows' % len(rows)})
                return self.send_json(200, rows[0], hdr)
            return self.send_json(200, rows, hdr)
        body = json.loads(self.body() or b'null')
        ret = 'return=representation' in prefer
        sel = build_select(name, params.get('select', ['*'])[0], 'rr') if ret else None
        if self.command == 'POST':
            rows = body if isinstance(body, list) else [body]
            if not rows: return self.send_json(201, [])
            cols = list(rows[0].keys())
            for c in cols:
                if not IDENT.match(c): raise DbError('PGRST204', 'bad col')
            conflict = ''
            if 'resolution=merge-duplicates' in prefer and params.get('on_conflict'):
                oc = params['on_conflict'][0]
                conflict = ' on conflict (%s) do update set %s' % (oc, ', '.join('%s = excluded.%s' % (c, c) for c in cols if c not in oc.split(','))) if [c for c in cols if c not in oc.split(',')] else ' on conflict (%s) do nothing' % oc
            elif 'resolution=ignore-duplicates' in prefer:
                conflict = ' on conflict do nothing'
            dml = 'insert into public.%s (%s) select %s from jsonb_populate_recordset(null::public.%s, %s::jsonb)%s returning *' % (
                name, ', '.join(cols), ', '.join(cols), name, lit(json.dumps(rows)), conflict)
            status = 201
        elif self.command == 'PATCH':
            cols = list(body.keys())
            for c in cols:
                if not IDENT.match(c): raise DbError('PGRST204', 'bad col')
            dml = 'update public.%s %s set (%s) = (select %s from jsonb_populate_record(null::public.%s, %s::jsonb)) where %s returning %s.*' % (
                name, alias, ', '.join(cols), ', '.join(cols), name, lit(json.dumps(body)), w, alias)
            if len(cols) == 1:
                dml = 'update public.%s %s set %s = (select %s from jsonb_populate_record(null::public.%s, %s::jsonb)) where %s returning %s.*' % (
                    name, alias, cols[0], cols[0], name, lit(json.dumps(body)), w, alias)
            status = 200
        elif self.command == 'DELETE':
            dml = 'delete from public.%s %s where %s returning %s.*' % (name, alias, w, alias)
            status = 200
        else:
            return self.send_json(405, {})
        sql = "with rr as (%s) select coalesce(json_agg(x), '[]') from (select %s from rr) x" % (dml, sel or 'rr.*')
        rows = json.loads(run(sql, claims, role))
        if not ret: return self.send_json(204 if status != 201 else 201, None)
        if single:
            if len(rows) != 1: return self.send_json(406, {'code': 'PGRST116', 'message': 'JSON object requested, multiple (or no) rows returned'})
            return self.send_json(status, rows[0])
        return self.send_json(status, rows)

    def where_with_table(self, params, alias, table):
        out = []
        for k, vals in params.items():
            if k in ('select', 'order', 'limit', 'offset', 'on_conflict', 'columns', '__table'): continue
            for v in vals:
                if k == 'or':
                    items = split_top(v.strip()[1:-1]); ors = []
                    for it in items:
                        col, _, rest = it.partition('.')
                        ors.append(cond(col, rest, alias))
                    out.append('(' + ' or '.join(ors) + ')')
                elif '.' in k:
                    rel, col = k.rsplit('.', 1)
                    out.append(embedded_exists(table, rel.split('.'), col, v, alias))
                else:
                    out.append(cond(k, v, alias))
        return ' and '.join(out) if out else 'true'

    # ---------------- GoTrue ----------------
    def user_json(self, uid):
        r = run("select row_to_json(u) from (select id, email, email_confirmed_at, last_sign_in_at, created_at from auth.users where id = %s) u" % lit(uid))
        u = json.loads(r) if r else None
        if u: u.update({'aud': 'authenticated', 'role': 'authenticated', 'app_metadata': {}, 'user_metadata': {}})
        return u
    def session(self, uid, email):
        exp = int(time.time()) + 3600
        tok = jwt({'sub': uid, 'email': email, 'role': 'authenticated', 'aud': 'authenticated', 'exp': exp})
        rt = secrets.token_hex(16); REFRESH[rt] = (uid, email)
        run("update auth.users set last_sign_in_at = now() where id = %s" % lit(uid))
        return {'access_token': tok, 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': exp, 'refresh_token': rt, 'user': self.user_json(uid)}
    def auth(self, u):
        path = u.path[len('/auth/v1/'):]
        q = urllib.parse.parse_qs(u.query)
        if path == 'token' and q.get('grant_type') == ['password']:
            b = json.loads(self.body())
            r = run("select json_build_object('id', id, 'email', email, 'banned', banned_until > now()) from auth.users where lower(email) = lower(%s) and encrypted_password = crypt(%s, encrypted_password)" % (lit(b.get('email')), lit(b.get('password'))))
            if not r: return self.send_json(400, {'error': 'invalid_grant', 'error_description': 'Invalid login credentials', 'msg': 'Invalid login credentials'})
            u2 = json.loads(r)
            if u2.get('banned'): return self.send_json(400, {'error': 'user_banned', 'msg': 'User is banned'})
            return self.send_json(200, self.session(u2['id'], u2['email']))
        if path == 'token' and q.get('grant_type') == ['refresh_token']:
            b = json.loads(self.body()); s = REFRESH.pop(b.get('refresh_token'), None)
            if not s: return self.send_json(400, {'error': 'invalid_grant', 'msg': 'Invalid Refresh Token'})
            return self.send_json(200, self.session(*s))
        c = verify((self.headers.get('Authorization') or '').replace('Bearer ', ''))
        if path == 'user' and self.command == 'GET':
            if not c or not c.get('sub'): return self.send_json(401, {'msg': 'invalid JWT'})
            return self.send_json(200, self.user_json(c['sub']))
        if path == 'user' and self.command == 'PUT':
            if not c or not c.get('sub'): return self.send_json(401, {'msg': 'invalid JWT'})
            b = json.loads(self.body())
            if b.get('password'): run("update auth.users set encrypted_password = crypt(%s, gen_salt('bf')) where id = %s" % (lit(b['password']), lit(c['sub'])))
            return self.send_json(200, self.user_json(c['sub']))
        if path == 'logout': return self.send_json(204, None)
        if path == 'recover': return self.send_json(200, {})
        return self.send_json(404, {'msg': 'not implemented: ' + path})

    # ---------------- Storage ----------------
    def storage(self, u):
        path = urllib.parse.unquote(u.path[len('/storage/v1/'):])
        claims, role = self.claims()
        m = re.match(r'^object/public/([a-z_-]+)/(.+)$', path)
        if m and self.command == 'GET':
            fp = os.path.join(FILES, m.group(1), m.group(2))
            if not os.path.isfile(fp): return self.send_json(404, {'error': 'not found'})
            data = open(fp, 'rb').read()
            self.send_response(200); self.send_header('Content-Type', open(fp + '.type').read() if os.path.exists(fp + '.type') else 'application/octet-stream'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        m = re.match(r'^object/([a-z_-]+)/(.+)$', path)
        if m and self.command == 'POST':
            bucket, name = m.group(1), m.group(2)
            data = self.body()
            b = run("select row_to_json(b) from storage.buckets b where id = %s" % lit(bucket))
            if not b: return self.send_json(400, {'statusCode': '404', 'error': 'Bucket not found', 'message': 'Bucket not found'})
            b = json.loads(b)
            ctype = self.headers.get('Content-Type', '')
            if ctype.startswith('multipart/form-data'):
                import email
                msg = email.message_from_bytes(b'Content-Type: ' + ctype.encode() + b'\r\n\r\n' + data)
                for part in msg.get_payload():
                    if part.get_filename() is not None or part.get_content_type().startswith(('image/', 'application/octet')):
                        if part.get_param('name', header='content-disposition') in ('cacheControl',): continue
                        data = part.get_payload(decode=True); ctype = part.get_content_type(); break
            if b.get('file_size_limit') and len(data) > b['file_size_limit']: return self.send_json(413, {'statusCode': '413', 'error': 'Payload too large', 'message': 'The object exceeded the maximum allowed size'})
            if b.get('allowed_mime_types') and ctype not in b['allowed_mime_types']: return self.send_json(415, {'statusCode': '415', 'error': 'invalid_mime_type', 'message': 'mime type %s is not supported' % ctype})
            run("insert into storage.objects (bucket_id, name, owner) values (%s, %s, auth.uid())" % (lit(bucket), lit(name)), claims, role)
            fp = os.path.join(FILES, bucket, name); os.makedirs(os.path.dirname(fp), exist_ok=True)
            open(fp, 'wb').write(data); open(fp + '.type', 'w').write(ctype)
            return self.send_json(200, {'Key': bucket + '/' + name, 'Id': name})
        m = re.match(r'^object/([a-z_-]+)$', path)
        if m and self.command == 'DELETE':
            bucket = m.group(1); names = json.loads(self.body() or b'{}').get('prefixes', [])
            out = run("select coalesce(json_agg(name), '[]') from (delete from storage.objects where bucket_id = %s and name = any(%s::text[]) returning name) d" % (
                lit(bucket), lit('{' + ','.join('"%s"' % n.replace('"', '') for n in names) + '}')), claims, role) if names else '[]'
            for n in json.loads(out):
                fp = os.path.join(FILES, bucket, n)
                for f in (fp, fp + '.type'):
                    if os.path.exists(f): os.remove(f)
            return self.send_json(200, [{'name': n} for n in json.loads(out)])
        return self.send_json(404, {'error': 'not implemented'})

if __name__ == '__main__':
    os.makedirs(FILES, exist_ok=True)
    print('local api on http://localhost:%d' % PORT, flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
