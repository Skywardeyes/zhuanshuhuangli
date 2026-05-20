const dateUtils = require('../../utils/dateUtils.js');

Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    monthData: { type: Array, value: [] },
    today: { type: Object, value: null }
  },

  data: {
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: []
  },

  observers: {
    'year, month'() {
      this.buildCalendar();
    }
  },

  methods: {
    buildCalendar() {
      const { year, month } = this.data;
      const daysInMonth = dateUtils.getDaysInMonth(year, month);
      const firstDay = dateUtils.getFirstDayOfWeek(year, month);

      const days = [];
      // 上月填充
      for (let i = 0; i < firstDay; i++) {
        days.push({ day: '', empty: true });
      }
      // 当月
      for (let d = 1; d <= daysInMonth; d++) {
        const idx = d - 1;
        const huangliDay = this.data.monthData[idx];
        days.push({
          day: d,
          empty: false,
          isToday: this.data.today && this.data.today.year === year && this.data.today.month === month && this.data.today.day === d,
          fortuneScore: huangliDay ? huangliDay.fortuneScore : null,
          fortuneLevel: huangliDay ? huangliDay.fortuneLevel : null
        });
      }
      this.setData({ calendarDays: days });
    },

    onDayTap(e) {
      const { day, empty } = e.currentTarget.dataset;
      if (empty || !day) return;
      this.triggerEvent('daytap', { year: this.data.year, month: this.data.month, day });
    }
  }
});
