<template>

  <!-- <div class="horiz-box">
    <div class="avatar alt"></div>
  </div> -->

  
  <div class="horiz-box" id="lumatron-header">
    <div class="video-container">
      <video autoplay loop muted playsinline class="large-horiz-video" id="sierpinskitron">
        <source src="@/assets/sierpinskitron.mp4" type="video/mp4">
      </video>
      <div class="video-color-corrector"></div>
    </div>
    <h1 id="tag-line">
      Custom <br>
      Light <br>
      Art
    </h1>
  </div>
  <div class="fancy-box section">
    <p>
      Every Lumatron is guaranteed unique and I work with every client to design a custom piece that fits their preferences.
    </p>
  </div>
  <div class="horiz-box tall"></div>
  <div class="horiz-box"><h1>Past Lumatrons</h1></div>
  <div class="horiz-box medium"></div>
  <div class="horiz-box">
    <div class="carousel">
      <video autoplay loop muted playsinline
          v-for="video in videos" class="catalogue-item">
        <source :src="getAssetUrl(video)" type="video/mp4">
      </video>

      <div class="carousel-dots">
        <div class="dot"
            v-for="i in carouselSize"
            @click="carouselTarget = i-1; updateCarousel()"
        >
          <div class="inner"
            :class="{selected: carouselTarget == i-1}">
          </div>
        </div>
      </div>
      <div class="control left" @click="carouselTarget -= 1; updateCarousel()"></div>
      <div class="control right" @click="carouselTarget += 1; updateCarousel()"></div>
    </div>
  </div>
  <div class="horiz-box tall"></div>
  <div class="horiz-box">
    <h1>Features</h1>
  </div>
  <div id="features">
    <div v-for="feature in features" class="feature">
      <div class="inner">
        <div v-if="feature.optional" class="optional">*</div>
        <div class="icon">
          <img :src="getAssetUrl(feature.icon)" />
        </div>
        <div class="copy">{{ feature.copy }}</div>
      </div>
    </div>
    <div v-for="i in 2 - (features.length+2) % 3" class="feature blank wide">
      <div class="inner">
        <div class="icon">
          <img src="@/assets/colors.svg"/>
        </div>
        <div class="copy"></div>
      </div>
    </div>
    <div v-for="i in 1 - (features.length+1) % 2" class="feature blank narrow">
      <div class="inner">
        <div class="icon">
          <img src="@/assets/colors.svg"/>
        </div>
        <div class="copy"></div>
      </div>
    </div>

    <div class="border"></div>
  </div>
  <div class="horiz-box section" style="justify-content: flex-end;">*optional</div>
  <div class="horiz-box tall"></div>
  <div class="horiz-box">
    <h1>Play with it!</h1>
  </div>
  <div class="horiz-box" id="demo-wrapper">
    <iframe id="demo" src="https://my.lumatron.art/demo/view?bgopacity=0.03&disablewheel&cameraz=10&controller=none" frameBorder="0"></iframe>
    <img src="@/assets/sierpinski-overlay-top.svg" class="emulator-overlay top">
    <img src="@/assets/sierpinski-overlay-walls.svg" class="emulator-overlay walls">
    
  </div>
  <div class="horiz-box controller-wrapper">
    <div class="horiz-box positioner">
      <div id="controller-qr">
        Scan to control with another device
        <img src="@/assets/controller-qrcode.svg">
      </div>
    </div>
    <div class="horiz-box positioner">
      <div id="controller">
        <iframe  src="https://my.lumatron.art/demo" frameBorder="0"></iframe>
        <div class="outline"></div>
      </div>
    </div>
  </div>
  <div class="horiz-box xtall"></div>
  <div class="horiz-box">
    <h1>Want one?</h1>
  </div>
  <div class="horiz-box"></div>

  <div class="fancy-box section">
    <p style="text-align: center;">
      For inquiries and quotes, email <a href="mailto:adrian@marplebot.com">adrian@marplebot.com</a>
    </p>
  </div>
  <div class="horiz-box xtall"></div>

  <div class="horiz-box">
    <h1>About me</h1>
  </div>
  <div class="fancy-box section">
    <img class="portrait" src="@/assets/Adrian.jpg">
    <p>
      I am a bay area artist whose medium more than anything is systems.
      With a background in math and computer science, I've undertaken a wandering journey
      making proofs, apps, chainmail, lighting, games, and myriad other creative endeavors.
      Even though I arose from the milieu of the purely digital and infinitely scalable,
      I've developed a magnetic attraction to that which can’t be perfectly captured in 1s and 0s
      and has a personal touch rather than mass reproducibility.
    </p>
    <p>
      You can see many of my other projects on <a href="https://marplebot.com">my main website</a>,
      and see slightly more up to date pictures on my <a href="https://www.instagram.com/adrianmarple">instagram</a>.
    </p>
  </div>
  <div class="horiz-box"></div>
  <div class="fancy-box section">
    <img class="portrait right" src="@/assets/mana-avatar.webp">
    <p>
      Lumatron has also had extensive help from Manadream (aka Mana).
      They're helped largely with networking and other low level programming tasks,
      but have really contributed throughout in various ways.
      Check out <a href="https://manadream.games">their website</a> as well to see their games.
    </p>
  </div>
  <div class="horiz-box tall"></div>
    <!-- TODO stuff about me (and Mana) 
      <p>
      To see other projects I work on, visit <a href="https://marplebot.com">https://marplebot.com</a>
    </p> -->
  <Signup/>
</template>
FancyButton
<script>
import Signup from "@/components/Signup"
import FancyButton from "@/components/FancyButton"

export default {
  name: 'Home',
  components: { Signup, FancyButton },
  data() {
    return  {
      startX: 0,
      carouselInterval: null,
      carouselPosition: 0,
      carouselTarget: 0,
      carouselVelocity: 0,
      videos: [
        "mirror-loop.mp4",
        "sierpinski.mp4",
        "Hexcat.mp4",
        "shower.mp4",
      ],
      features: [
        {
          icon: "qr.svg",
          copy: "Scan QR code to control",
        },
        {
          icon: "wifi.svg",
          copy: "WiFi connected",
        },
        {
          icon: "colors.svg",
          copy: "Select colors",
        },
        {
          icon: "pattern.svg",
          copy: "Choose from various patterns",
        },
        {
          icon: "night.svg",
          copy: "Can automatically turn off at night",
        },
        {
          icon: "save.svg",
          copy: "Save preferences",
        },
        {
          icon: "games.svg",
          copy: "Games",
        },
        {
          icon: "download.svg",
          copy: "Automatically gets software updates",
        },
        {
          icon: "14-segment.png",
          copy: "4-charater 14 segment display",
        },
        {
          icon: "thunderstorm.svg",
          copy: "Pattern based on weather",
          optional: true,
        },
        {
          icon: "mic.svg",
          copy: "Music responsive",
          optional: true,
        },
        {
          icon: "lock.svg",
          copy: "Security code",
          optional: true,
        },
        {
          icon: "egg.svg",
          copy: "Easter eggs (ask me)",
          optional: true,
        },
        {
          icon: "twitch.png",
          copy: "Twitch integration (upcoming)",
          optional: true,
        },
        {
          icon: "question_exchange.svg",
          copy: "Request special features",
          optional: true,
        },
      ]
    }
  },
  mounted() {
    const video = document.getElementById("sierpinskitron")
    video.addEventListener("loadedmetadata", () => {
      document.querySelector(".video-color-corrector").style.display = "block"
    })
    this.updateCarousel()

    
    onmousedown = this.handleStart
    onmouseup = this.handleEnd
    onmousemove = this.handleChange

    // document.body.addEventListener("touchstart", event => {
    //   this.handleStart(event.touches[0])
    // })
    // document.body.addEventListener("touchend", event => {
    //   this.handleEnd(event.touches[0])
    // })
    // document.body.addEventListener("touchmove", event => {
    //   this.handleChange(event.touches[0])
    // })
  },
  computed: {
    carouselSize() {
      return this.videos.length
    },
  },

  methods: {
    getAssetUrl(name) {
      if (!name) return
      return require("@/assets/" + name)
    },
    advanceCarousel() {
      this.carouselPosition += 1
      this.updateCarousel()
    },
    updateCarousel() {
      if (this.carouselInterval) {
        return
      }
      this.carouselInterval = setInterval(() => {
        this.carouselTarget = Math.max(0, this.carouselTarget)
        this.carouselTarget = Math.min(this.videos.length - 1, this.carouselTarget)

        let motionBlur = 0
        if (!this.isDragging) {
          const alpha = 0.4
          this.carouselVelocity = alpha * this.carouselVelocity
          let startingPosition = this.carouselPosition
          this.carouselPosition += this.carouselVelocity
          this.carouselPosition = alpha * this.carouselPosition + (1 - alpha) * this.carouselTarget
          let delta = this.carouselPosition - startingPosition
          let maxSpeed = 0.4
          if (Math.abs(delta) > maxSpeed) {
            delta = maxSpeed * Math.sign(delta)
            this.carouselPosition = startingPosition + delta
          }
          motionBlur = Math.abs(delta)*2
        }
        let slides = document.querySelectorAll(".carousel video")
        for (let i = 0; i < slides.length; i++) {
          let slide = slides[i]
          let offset = i - this.carouselPosition
          slide.style.transform = `
              translateX(${Math.sign(offset)*Math.pow(Math.abs(offset), 0.5)*50}%)
              scale(${1/(Math.abs(offset)/2 + 1)})`
          slide.style.zIndex = Math.round(100 - Math.abs(offset*2))
          let opacity = 1/Math.pow(Math.abs(offset) + 1,2)
          opacity = Math.min(opacity, 1 - motionBlur)
          slide.style.opacity = opacity
        }
        
        this.$forceUpdate()
        if (Math.abs(this.carouselPosition - this.carouselTarget) < 0.0001) {
          clearInterval(this.carouselInterval)
          this.carouselInterval = null
        }
      }, 33)
    },

    handleStart(location) {
      let carouselPosition = document.querySelector(".carousel").getBoundingClientRect()
      if (carouselPosition.top > location.clientY ||
          carouselPosition.bottom < location.clientY) {
        return
      }
      this.startX = location.clientX
      this.timestamp = Date.now()
      this.isDragging = true
    },
    handleEnd() {
      if (this.isDragging) {
        let finalPosition = this.carouselPosition + this.carouselVelocity * 20
        this.carouselTarget = Math.round(finalPosition)
        this.carouselTarget = Math.max(this.carouselTarget, 0)
        this.carouselTarget = Math.min(this.carouselTarget, this.videos.length - 1)
        this.updateCarousel()
        this.isDragging = false
      }
    },
    handleChange(location) {
      if (this.isDragging) {
        let delta = (this.startX - location.clientX) / 450
        this.carouselPosition += delta
        this.carouselVelocity = Math.max(Math.min(delta,0.2),-0.2)
        this.startX = location.clientX
        this.updateCarousel()
      }
    },
  },
}
</script>

<style>
.section {
  padding: 0 24px;
  box-sizing: border-box;
  font-size: 2.5em;
}
.section a {
  text-decoration: underline;
}

.large-horiz-video {
  width: 100%;
}

#lumatron-header {
  /* justify-content: flex-start; */
  position: relative;
}

.video-container {
  position: relative;
  width: 420px;
  height: 420px;
  max-height: 100vw;
}
.video-color-corrector {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0.004;
  background: white;
  display: none;
}
#tag-line {
  position: absolute;
  left: 0;
  top: 64px;
  text-align: left;
}

.carousel {
  display: flex;
  justify-content: center;
  position: relative;
  height: 800px;
  max-height: 177vw;
  width: 100%;
  max-width: 450px;
}
.catalogue-item {
  width: 100%;
  box-shadow: 0 0 12px rgba(255,255,255, 0.7), 0 0 8px rgba(255,255,255, 0.7), 0 0 4px rgba(255,255,255, 0.7);
  z-index: 1;
  position: absolute;
  border-radius: 12px;
}


.slide {
  width: 100%;
  padding:  0 2rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.carousel-dots {
  display: flex;
  position: absolute;
  z-index: 101;
  bottom: 0;
}
.carousel-dots .dot {
  padding: 1rem;
  margin:  0.5rem;
}
.carousel-dots .dot .inner {
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  background: white;
  opacity: 0.5;
  box-shadow: 0 0 4px black;
  /* box-shadow: 0 0 8px white; */
}
.carousel-dots .dot .inner.selected {
  opacity: 1;
  box-shadow: 0 0 8px white, 0 0 12px white;
}

.carousel .control {
  position: absolute;
  height: 100%;
  width: 50%;
  z-index: 111;
  background-repeat: no-repeat;
  background-size: 40%;
  background-position-y: center;
  opacity: 0;
}
.carousel .control.left {
  left: 0;
  background-image: url("@/assets/chevronleft.svg");
  background-position-x: left;
}
.carousel .control.right {
  right: 0;
  background-image: url("@/assets/chevronright.svg");
  background-position-x: right;
}

#features {
  display: grid;
  position: relative;
  width: 100%;
  grid-template-columns: repeat(3, 1fr);
}
#features .border {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4px solid var(--bg-color);
  box-sizing: border-box;
}
@media only screen and (max-device-width: 480px) {
  #features {
    grid-template-columns: repeat(2, 1fr);
  }
}
.feature {
  border: 8px solid var(--bg-color);
}
.feature .inner {
  margin: 2px;
  background-color: var(--bg-color);
  position: relative;
}
.feature .inner .optional {
  position: absolute;
  right: 6px;
  top: 0;
  font-size: 2rem;
}
.feature .inner .icon {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 36px solid var(--bg-color);
  border-bottom-width: 0;
}
.feature .inner .icon img {
  width: 100%;
  filter: invert(100%) drop-shadow(white 0 0 5px);
}
.feature .inner .copy {
  height: 25%;
  font-size: 1rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
  height: 80px;
  padding: 0 8px;
}

.feature.blank.narrow {
  display: none;
}
.feature.blank .inner {
  margin: 0;
  padding: 2px;
}
.feature.blank .inner img {
  opacity: 0;
}
@media only screen and (max-device-width: 480px) {
  .feature.blank.wide {
    display: none;
  }
  .feature.blank.narrow {
    display: block;
  }
}


#demo-wrapper {
  position: relative;
  filter: brightness(1.5)
}
#demo {
  width: 100%;
  height: 700px;
  max-height: 100vw;
}
.emulator-overlay {
  position: absolute;
  width: 78%;
  top: 15.2%;
}
.emulator-overlay.top {
  opacity: 0.3;
  filter:drop-shadow(white 0 0 12px);
}
.emulator-overlay.walls {
  opacity: 0.7;
}

#controller {
  width: 250px;
  max-width: 100vw;
  height: 450px;
  position: absolute;
  right: -200px;
  bottom: 40px;
}
#controller iframe {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 8px 16px 8px 10px;
  border-radius: 36px;
}
#controller .outline {
  position: absolute;
  background-image: url("@/assets/smartphone.svg");
  background-size: contain;
  background-repeat: no-repeat;
  filter: invert();
  width: 100%;
  height: 100%;
  top: 0;
  pointer-events: none;
}
#controller-qr {
  position: absolute;
  left: -180px;
  bottom: 200px;
  width: 200px;
  max-width: 100vw;
  text-align: center;
  font-size: 1rem;
}
#controller-qr img {
  background-image: url("@/assets/controller-qrcode.svg");
  background-size: contain;
  filter: invert();
  opacity: 0.8;
  width: 100%;
  margin-top: 20px;
}

@media (max-device-width: 1050px) {
  #controller {
    position: relative;
    width: 350px;
    max-width: 100vw;
    height: 640px;
    right: -3px;
    margin-top: 48px;
  }
  #controller iframe {
    border-radius: 60px;
  }

  #controller-qr {
    position: relative;
    bottom: initial;
    left: initial;

  }
}
@media (max-device-width: 600px) {
  .horiz-box.controller-wrapper {
    flex-direction: column-reverse;
  }
}

.portrait {
  width: 200px !important;
  height: 200px;
  border-radius: 50%;
  margin: 24px 0;
  float: left;
}

.portrait.right {
  width: 200px !important;
  height: 200px;
  border-radius: 50%;
  margin: 24px 0;
  float: right;
}

@media only screen and (max-device-width: 480px) {
  .portrait {
    padding: 0 calc(50% - 100px) !important;
    float: none !important;
  }

  #lumatron-header {
    overflow: hidden;
  }
  .video-container {
    margin-top: 100px;
    margin-left: 36px;
    margin-right: -36px;
    background: black;
    overflow: hidden;
  }
  .video-container video {
    background-color: transparent;
  }

  .carousel .control {
    opacity: 0.5;
  }
}


</style>
