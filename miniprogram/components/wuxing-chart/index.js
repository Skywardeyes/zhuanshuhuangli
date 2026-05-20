Component({
  properties: {
    wuxingCount: {
      type: Object,
      value: {}
    },
    xiyong: {
      type: Object,
      value: { xiyong: [], jishen: [] }
    }
  },

  data: {
    wuxingList: ['金', '木', '水', '火', '土'],
    colors: {
      '金': '#DAA520',
      '木': '#4CAF50',
      '水': '#2196F3',
      '火': '#C41E1E',
      '土': '#8D6E63'
    },
    maxCount: 1
  },

  observers: {
    'wuxingCount'() {
      const vals = Object.values(this.data.wuxingCount || {});
      const max = Math.max(...vals, 1);
      this.setData({ maxCount: max });
    }
  }
});
