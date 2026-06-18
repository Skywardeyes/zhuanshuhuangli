Component({
  properties: {
    score: { type: Number, value: 50 },
    level: { type: String, value: '平' },
    size: { type: String, value: 'normal' },
    currentTheme: { type: Object, value: null }
  },

  data: {
    levelColor: {
      '大吉': '#C41E1E',
      '吉': '#E57373',
      '平': '#B8860B',
      '凶': '#795548',
      '大凶': '#424242'
    }
  }
});
