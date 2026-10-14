/* =========================================================
   Zari Admin — review moderation. Only approved reviews are public
   (RLS). Reviews can only be written by customers with a paid order.
   ========================================================= */
(function () {
  var esc = ZA.esc;
  var table;
  function setStatus(id, status) {
    return ZA.q(ZA.db.from('reviews').update({ status: status }).eq('id', id).select('id')).then(function (r) {
      if (!r.length) throw new Error('You don’t have permission to do that.');
    });
  }
  ZA.routes.reviews = {
    perm: 'reviews',
    render: function (params, el) {
      ZA.setPage('Reviews', [['Sales']]);
      el.innerHTML = '<div id="revTable"></div>';
      table = new ZA.DataTable({
        id: 'reviews', el: ZA.qs('#revTable'), search: 'Search review text', selectable: true, defaultSort: { col: 'created_at', asc: false },
        defaultFilters: { status: 'pending' },
        filters: [{ key: 'status', label: 'Status', options: [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']] }, { key: 'rating', label: 'Rating', options: [['5', '5 ★'], ['4', '4 ★'], ['3', '3 ★'], ['2', '2 ★'], ['1', '1 ★']] }],
        columns: [
          { label: 'Product', render: function (r) { return r.products ? '<a class="cell-title" href="#/products/' + r.product_id + '">' + esc(r.products.name) + '</a>' : ''; } },
          { label: 'Rating', sort: 'rating', cls: 'nowrap', render: function (r) { return '<span style="color:var(--gold-500);">' + '★'.repeat(r.rating) + '</span><span class="muted">' + '★'.repeat(5 - r.rating) + '</span>'; } },
          { label: 'Review', render: function (r) { return '<div style="max-width:440px;">' + esc(r.review_text || '') + '</div><div class="cell-sub">Verified purchase · ' + ZA.date(r.created_at) + '</div>'; } },
          { label: 'Status', render: function (r) { return ZA.pill(r.status); } },
          { label: '', cls: 'actions', render: function (r) {
            return (r.status !== 'approved' ? '<button class="link" data-action="review-set" data-id="' + r.id + '" data-s="approved">Approve</button>' : '') +
              (r.status !== 'rejected' ? '<button class="link" data-action="review-set" data-id="' + r.id + '" data-s="rejected">Reject</button>' : '') +
              '<button class="link danger" data-action="review-delete" data-id="' + r.id + '">Delete</button>';
          } }
        ],
        query: function (st) {
          var q = ZA.db.from('reviews').select('*, products(name)', { count: 'exact' });
          if (st.filters.status) q = q.eq('status', st.filters.status);
          if (st.filters.rating) q = q.eq('rating', Number(st.filters.rating));
          return ZA.applyTableState(q, st, ['review_text']).then(function (res) { return { rows: ZA.unwrap(res), total: res.count || 0 }; });
        },
        emptyTitle: 'No reviews here',
        bulk: [
          { label: 'Approve', run: function (rows) { Promise.all(rows.map(function (r) { return setStatus(r.id, 'approved'); })).then(function () { ZA.ok('Approved ' + rows.length); table.clearSelection(); table.reload(); }).catch(ZA.fail); } },
          { label: 'Reject', run: function (rows) { Promise.all(rows.map(function (r) { return setStatus(r.id, 'rejected'); })).then(function () { ZA.ok('Rejected ' + rows.length); table.clearSelection(); table.reload(); }).catch(ZA.fail); } }
        ]
      });
    }
  };
  ZA.actions['review-set'] = function (b) {
    setStatus(b.getAttribute('data-id'), b.getAttribute('data-s')).then(function () { ZA.ok(b.getAttribute('data-s') === 'approved' ? 'Review approved — now public' : 'Review rejected'); table.reload(); }).catch(ZA.fail);
  };
  ZA.actions['review-delete'] = function (b) {
    ZA.confirm('Delete this review permanently?', { danger: true, confirmLabel: 'Delete' }).then(function (ok) {
      if (!ok) return;
      ZA.q(ZA.db.from('reviews').delete().eq('id', b.getAttribute('data-id')).select('id')).then(function (r) {
        if (!r.length) throw new Error('You don’t have permission to do that.');
        ZA.ok('Review deleted'); table.reload();
      }).catch(ZA.fail);
    });
  };
})();
