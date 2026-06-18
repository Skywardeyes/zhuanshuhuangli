var app = getApp();

Component({
  properties: {
    visible: { type: Boolean, value: true },
    currentTheme: { type: Object, value: null }
  },

  data: {
    currentName: '',
    currentBaziId: '',
    showDropdown: false,
    baziList: []
  },

  lifetimes: {
    attached: function () {
      this.refresh();
    }
  },

  pageLifetimes: {
    show: function () {
      this.refresh();
    }
  },

  methods: {
    refresh: function () {
      var records = app.globalData.baziRecords || [];
      var currentId = app.globalData.currentBaziId;
      var currentName = '选择八字';
      for (var i = 0; i < records.length; i++) {
        if (records[i]._id === currentId) {
          currentName = records[i].name || ('八字' + (i + 1));
          break;
        }
      }
      this.setData({ baziList: records, currentName: currentName, currentBaziId: currentId });
    },

    toggleDropdown: function () {
      if (this.data.baziList.length === 0) return;
      this.setData({ showDropdown: !this.data.showDropdown });
    },

    selectBazi: function (e) {
      var baziId = e.currentTarget.dataset.id;
      app.setActiveBaziById(baziId);
      this.triggerEvent('bazichange', { baziId: baziId });
      this.setData({ showDropdown: false });
      this.refresh();
    },

    goToCreate: function () {
      this.setData({ showDropdown: false });
      wx.navigateTo({ url: '/pages/birth-input/birth-input' });
    },

    closeDropdown: function () {
      this.setData({ showDropdown: false });
    }
  }
});
