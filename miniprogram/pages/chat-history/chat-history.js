var api = require('../../utils/api.js');
var app = getApp();

Page({
  data: {
    conversations: [],
    loading: true,
    currentTheme: null,
    // Rename modal
    showRenameModal: false,
    renameId: '',
    renameTitle: ''
  },

  onLoad: function () {
    this.syncTheme();
  },

  onShow: function () {
    this.syncTheme();
    this.loadConversations();
  },

  syncTheme: function () {
    var theme = app.globalData.currentTheme;
    this.setData({ currentTheme: theme });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: theme.navBg,
      animation: { duration: 300, timingFunc: 'easeIn' }
    });
  },

  loadConversations: function () {
    var self = this;
    self.setData({ loading: true });
    api.listConversations().then(function (res) {
      if (res.success) {
        self.setData({ conversations: res.conversations || [], loading: false });
      } else {
        self.setData({ loading: false });
      }
    }).catch(function () {
      self.setData({ loading: false });
    });
  },

  // Enter a conversation
  enterConversation: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    app.setActiveConversation(id);
    wx.switchTab({ url: '/pages/index/index' });
  },

  // Rename
  onRenameTap: function (e) {
    var id = e.currentTarget.dataset.id;
    var title = e.currentTarget.dataset.title || '';
    this.setData({
      showRenameModal: true,
      renameId: id,
      renameTitle: title
    });
  },

  closeRenameModal: function () {
    this.setData({ showRenameModal: false });
  },

  onRenameInput: function (e) {
    this.setData({ renameTitle: e.detail.value });
  },

  confirmRename: function () {
    var self = this;
    var id = self.data.renameId;
    var title = self.data.renameTitle.trim();
    if (!id || !title) return;

    self.setData({ showRenameModal: false });
    api.renameConversation(id, title).then(function (res) {
      if (res.success) {
        // Update local list
        var list = self.data.conversations;
        for (var i = 0; i < list.length; i++) {
          if (list[i]._id === id) {
            list[i].title = title;
            break;
          }
        }
        self.setData({ conversations: list });
        wx.showToast({ title: '已重命名', icon: 'success', duration: 1000 });
      }
    }).catch(function () {});
  },

  // Delete
  onDeleteTap: function (e) {
    var id = e.currentTarget.dataset.id;
    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '删除对话后，所有消息记录将被清除。此操作不可恢复。',
      success: function (res) {
        if (res.confirm) {
          api.deleteConversation(id).then(function (result) {
            if (result.success) {
              // Remove from list
              var list = self.data.conversations;
              var newList = [];
              for (var i = 0; i < list.length; i++) {
                if (list[i]._id !== id) newList.push(list[i]);
              }
              self.setData({ conversations: newList });

              // If deleted the active conversation, clear it
              if (app.globalData.activeConversationId === id) {
                app.clearActiveConversation();
              }
              wx.showToast({ title: '已删除', icon: 'success', duration: 1000 });
            }
          }).catch(function () {});
        }
      }
    });
  },

  // Create new
  onNewConversation: function () {
    app.clearActiveConversation();
    wx.switchTab({ url: '/pages/index/index' });
  },

  formatTime: function (dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };

    var month = pad(d.getMonth() + 1);
    var day = pad(d.getDate());
    var hour = pad(d.getHours());
    var min = pad(d.getMinutes());

    // Same day: show time only
    if (d.toDateString() === now.toDateString()) {
      return '今天 ' + hour + ':' + min;
    }
    // Yesterday
    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return '昨天 ' + hour + ':' + min;
    }
    return month + '-' + day + ' ' + hour + ':' + min;
  }
});
