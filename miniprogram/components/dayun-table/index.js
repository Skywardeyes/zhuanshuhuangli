Component({
  properties: {
    dayun: {
      type: Object,
      value: { direction: '', qiyunAge: 0, dayunList: [] }
    },
    currentAge: {
      type: Number,
      value: 0
    }
  },

  computed: {},

  methods: {
    isCurrentDayun(item) {
      const age = this.data.currentAge;
      return age >= item.ageStart && age <= item.ageEnd;
    }
  }
});
