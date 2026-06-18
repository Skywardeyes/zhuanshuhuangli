var api = require('../../utils/api.js');
var app = getApp();

Component({
  properties: {
    currentTheme: { type: Object, value: null },
    baziRecords: { type: Array, value: [] },
    activeConversationId: { type: String, value: '' }
  },

  data: {
    messages: [],
    selectedBaziIds: [],
    showBaziSelector: false,
    inputText: '',
    sending: false,
    loadingMessages: false,
    scrollToView: ''
  },

  lifetimes: {
    attached: function () {
      this._twTimer = null;
      if (this.properties.activeConversationId) {
        this.loadMessages();
      }
    },
    detached: function () {
      if (this._twTimer) {
        clearTimeout(this._twTimer);
        this._twTimer = null;
      }
    }
  },

  pageLifetimes: {
    show: function () {
      var convId = app.globalData.activeConversationId;
      if (convId && convId !== this.properties.activeConversationId) {
        this.setData({ messages: [] });
        this.loadMessages();
      } else if (!convId) {
        this.setData({ messages: [], selectedBaziIds: [] });
      }
    }
  },

  observers: {
    'activeConversationId': function (newVal) {
      if (newVal) {
        this.loadMessages();
      } else {
        this.setData({ messages: [], selectedBaziIds: [] });
      }
    }
  },

  methods: {
    loadMessages: function () {
      var convId = this.properties.activeConversationId || app.globalData.activeConversationId;
      if (!convId) return;

      var self = this;
      self.setData({ loadingMessages: true });

      api.getChatMessages(convId).then(function (res) {
        if (res.success) {
          var msgs = (res.messages || []).map(function (m) {
            m.displayText = m.content;
            m._completed = true;
            return m;
          });
          self.setData({ messages: msgs, loadingMessages: false });
          self.scrollToBottom();
        } else {
          self.setData({ loadingMessages: false });
        }
      }).catch(function () {
        self.setData({ loadingMessages: false });
      });
    },

    onSend: function () {
      var self = this;
      var content = self.data.inputText.trim();
      if (!content || self.data.sending) return;

      // Default to active bazi if none selected
      var baziIds = self.data.selectedBaziIds.slice();
      if (baziIds.length === 0 && app.globalData.currentBaziId) {
        baziIds = [app.globalData.currentBaziId];
      }
      if (baziIds.length === 0) {
        wx.showToast({ title: '请先选择八字', icon: 'none' });
        return;
      }

      var conversationId = self.properties.activeConversationId || app.globalData.activeConversationId || '';

      // Optimistic user message
      var messages = self.data.messages;
      messages.push({
        _id: 'temp_' + Date.now(),
        role: 'user',
        content: content,
        displayText: content,
        _completed: true,
        baziIds: baziIds
      });
      self.setData({ messages: messages, inputText: '', sending: true });
      self.scrollToBottom();

      api.sendChatMessage({
        conversationId: conversationId,
        baziIds: baziIds,
        content: content
      }).then(function (res) {
        if (res.success) {
          // Replace temp user message with real one (keep display)
          if (res.conversationId) {
            app.setActiveConversation(res.conversationId);
          }

          // Add AI reply with typewriter
          var replyContent = res.reply.content || '';
          var replyId = res.reply._id || ('reply_' + Date.now());

          var msgs = self.data.messages;
          msgs.push({
            _id: replyId,
            role: 'assistant',
            content: replyContent,
            displayText: '',
            _completed: false,
            baziIds: baziIds
          });
          self.setData({ messages: msgs, sending: false });
          self.scrollToBottom();

          // Start typewriter
          self._startTypewriter(replyContent, replyId);
        } else {
          self.setData({ sending: false });
          wx.showToast({ title: res.errMsg || '发送失败', icon: 'none' });
        }
      }).catch(function () {
        self.setData({ sending: false });
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      });
    },

    _startTypewriter: function (fullText, msgId) {
      var self = this;
      var index = 0;
      var speed = fullText.length > 500 ? 20 : 40;

      function tick() {
        if (index >= fullText.length) {
          // Done
          var msgs = self.data.messages;
          for (var i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i]._id === msgId) {
              msgs[i].displayText = fullText;
              msgs[i]._completed = true;
              break;
            }
          }
          self.setData({ messages: msgs });
          self.scrollToBottom();
          return;
        }
        index = Math.min(index + 1, fullText.length);
        var displayText = fullText.substring(0, index);

        var msgs = self.data.messages;
        for (var j = msgs.length - 1; j >= 0; j--) {
          if (msgs[j]._id === msgId) {
            msgs[j].displayText = displayText;
            break;
          }
        }
        self.setData({ messages: msgs });
        self.scrollToBottom();

        self._twTimer = setTimeout(tick, speed);
      }
      tick();
    },

    // Skip current typewriter if any
    skipTypewriter: function () {
      if (this._twTimer) {
        clearTimeout(this._twTimer);
        this._twTimer = null;
      }
      var msgs = this.data.messages;
      for (var i = 0; i < msgs.length; i++) {
        if (!msgs[i]._completed) {
          msgs[i].displayText = msgs[i].content;
          msgs[i]._completed = true;
        }
      }
      this.setData({ messages: msgs });
    },

    // Bazi selector
    toggleBaziSelector: function () {
      var show = !this.data.showBaziSelector;
      // Default select active bazi when opening
      if (show && this.data.selectedBaziIds.length === 0 && app.globalData.currentBaziId) {
        this.setData({
          showBaziSelector: show,
          selectedBaziIds: [app.globalData.currentBaziId]
        });
      } else {
        this.setData({ showBaziSelector: show });
      }
    },

    toggleBaziCheck: function (e) {
      var baziId = e.currentTarget.dataset.id;
      var selected = this.data.selectedBaziIds.slice();
      var idx = selected.indexOf(baziId);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        selected.push(baziId);
      }
      this.setData({ selectedBaziIds: selected });
    },

    selectAllBazis: function () {
      var allIds = (this.properties.baziRecords || []).map(function (b) { return b._id; });
      this.setData({ selectedBaziIds: allIds });
    },

    clearBaziSelection: function () {
      this.setData({ selectedBaziIds: [] });
    },

    onInputChange: function (e) {
      this.setData({ inputText: e.detail.value });
    },

    scrollToBottom: function () {
      var msgs = this.data.messages;
      if (msgs.length > 0) {
        this.setData({ scrollToView: 'msg-' + msgs.length });
      }
    },

    onNewChat: function () {
      if (this._twTimer) {
        clearTimeout(this._twTimer);
        this._twTimer = null;
      }
      app.clearActiveConversation();
      this.setData({ messages: [], selectedBaziIds: [], inputText: '' });
    },

    onManageChats: function () {
      wx.navigateTo({ url: '/pages/chat-history/chat-history' });
    },

    getBaziName: function (baziId) {
      var records = this.properties.baziRecords || [];
      for (var i = 0; i < records.length; i++) {
        if (records[i]._id === baziId) return records[i].name || '未命名';
      }
      return '未知';
    }
  }
});
