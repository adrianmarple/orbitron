<template>
  <svg id="four-oh-four">
    <mask id="four-oh-four-mask" x="0" y="0">
      <rect x=0 y=0 :width="width" height=64 fill="white"></rect>
      <text x=0 y=40 fill="black">404 - Page not found</text>
    </mask>
    <rect class="main-rect"
          :width="width"
          height=64
          mask="url(#four-oh-four-mask)"
          fill="var(--bg-color)">
    </rect>
      <!-- <text x=0 y=36 fill="white">404 - Page not found</text> -->
  </svg>
</template>

<script>
export default {
  name: '404',
  data() {
    return {
      width: 664,
    }
  },
  mounted() {
    this.width = this.getWidth()
    let self = this
    addEventListener('resize', (event) => {
      self.innerWidth = innerWidth
      self.$forceUpdate()
    });
  },
  methods: {
    getWidth() {
      return this.$el.getBoundingClientRect().width
    },
  },
}
</script>

<style>
#four-oh-four {
  width: 100%;
  height: 64px;
  background-color: transparent;
  font-size: 1.3em;
  margin-bottom: -8px;
}

</style>
