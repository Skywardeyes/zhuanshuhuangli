Component({
  properties: {
    dayun: { type: Object, value: { direction: '', qiyunAge: 0, dayunList: [] } },
    currentAge: { type: Number, value: 0 },
    currentTheme: { type: Object, value: null }
  },

  methods: {
    isCurrentDayun(item) {
      const age = this.data.currentAge;
      return age >= item.ageStart && age <= item.ageEnd;
    }
  }
});
