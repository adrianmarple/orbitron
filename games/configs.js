GAMES_INFO = [
  {
    name: "snektron",
    label: "Snake",
    rules: [
      {
        words: [
          "You are currently playing Snake.",
        ],
      },
      {
        words: ["Eat to grow."],
        image: "/images/snektronEatTutorial.gif",
      },
      {
        words: ["Shrink on contact."],
        image: "/images/snektronShrinkTutorial.gif",
      },
    ],
    victoryCondition: "Record longest snake wins",
    statusDisplay: {
      type: "rankedscore",
      innerScore: true,
    },
  },
  {
    name: "colorwar",
    label: "Color War",
    rules: [
      {
        words: [
          "You are currently playing Color War.",
        ],
      },
      {
        words: [
          "Wherever you go, you leave behind your color.",
          "Your score is the number of pixels turned your color.",
        ],
      },
    ],
    victoryCondition: "Have the top score at the end of the round.",
    statusDisplay: {
      type: "rankedscore",
    },
  },
  {
    name: "pacman",
    label: "Co-op PacMan",
    rules: [
      {
        words: [
          "You are currently playing Co-op Pac-Man.",
        ],
      },
      {
        words: ["You are one of several Pac-Men trying to avoid enemy AI ghosts. If you run into a RED ghost you lose a collective life."],
      },
      {
        words: [
          "Eating a normal pellet earns you 10 points.",
          "Eating a flashing POWER PELLET earns you 50 points.",
        ]
      },
      {
        words: [
          "Eating a POWER PELLET also makes the ghosts scared (pink).",
          "Eating a PINK scared ghost earns you 200 points!",
        ],
      },
      {
        words: [
          "You all win if you achieve the required victory score!",
        ],
      },
    ],
    victoryCondition: "You all win if you reach score {{state.data.victory_score}}",
    statusDisplay: {
      type: "cooperative",
      showScore: true,
      showLives: true,
    },
  },
  {
    name: "bomberman",
    label: "Bomberman",
    rules: [
      { words: [ "You are currently playing Bomberman.", ], },
      { words: [ "Tap to place a bomb." ], },
      {
        words: [
          "Tap again to kick your bomb.",
          "Or if you move into a bomb you will also kick it.",
        ],
      },
      {
        words: [
          "The white pixels are walls.",
          "You can't pass through them, but you can blow them up.",
        ],
      },
      {
        words: [
          "If you get hit by a bomb you will get hurt.",
          "Get hurt twice and you're dead.",
        ],
      },
    ],
    tapInstructions: "Tap to Bomb",
    victoryCondition: "Last one standing wins",
    statusDisplay: {
      type: "battleroyale",
    },
  },
  {
    name: "redlightgreenlight",
    label: "Red Light Pink Light",
    rules: [
      { words: [ "You are currently playing Red Light Pink Light", ], },
      { words: [ "You can only move when the dots glow pink"], },
      { words: [ "When you reach a pink light you score"], },
      { words: [ "You'll get sent back to the start if you try to move when the dots are red", ], },
    ],
    victoryCondition: "Whoever reaches the most pink lights wins!",
    statusDisplay: {
      type: "rankedscore",
    },
  },
  {
    name: "basedefense",
    label: "Base Defense",
    rules: [
      { words: [ "You are currently playing co-op Base Defense", ], },
      { words: [ "Stop the RED enemies before they reach the bottom" ], },
      { words: [ "Survive the round to collectively win", ], },
    ],
    victoryCondition: "Survive for {{state.config.ROUND_TIME}} seconds.",
    statusDisplay: {
      type: "cooperative",
      showLives: true,
    },
  },
  {
    name: "dominion",
    label: "Dominion",
    rules: [
      { words: [ "You are currently playing Dominion", ], },
      { words: [ "Occupy a spotlight to turn it to your color", ], },
      { words: [ "Once a spotlight is your color it earns points for you", ], },
      { words: [ "Tap to dash.", "If you dash into another player you'll push them."], },
    ],
    victoryCondition: "Get the highest score.",
    statusDisplay: {
      type: "rankedscore",
    },
  },
]

GLOBAL_RULES = [
  {
    words: [
      "Welcome!",
      "You are playing Super Orbitron!",
    ]
  },
  {
    words: [
      "You will be playing a series of minigames.",
      "The rules change every round, so be sure to read them.",
    ],
  },
  {
    words: [
      "Once a game has started you can drag on your phone to move.",
    ],
    image: "/images/snektronMovementTutorial.gif",
  },
  {
    words: ["Your color is <span style='color:{{self.color}}'>{{self.colorName}}</span>, so look for the <span style='color:{{self.color}}'>{{self.colorName}}</span> pixel once the game starts."],
  },
]
