let GAMES_INFO = [
  {
    name: "snektron",
    label: "Snekton",
    rules: [
      {
        words: [
          "Welcome!",
          "You are currently playing Snektron in sandbox mode.",
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
      {
        words: ["Drag to move."],
        image: "/images/snektronMovementTutorial.gif",
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
          "Welcome!",
          "You are currently playing Color War in sandbox mode.",
        ],
      },
      {
        words: [
          "Wherever you go, it turns your color.",
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
          "Welcome!",
          "You are currently playing Co-op Pac-Man in sandbox mode.",
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
      type: "cooperativescore",
      showLives: true,
    },
  },
  {
    name: "bomberman",
    label: "Bomberman",
    rules: [
      {
        words: [
          "Welcome!",
          "You are currently playing Bomberman in sandbox mode.",
        ],
      },
      {
        words: ["Tap to place a bomb."],
      },
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
          "If you hit yourself, you will get stunned.",
          "If you hit someone else with your bomb they get hurt.",
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
      {
        words: [
          "Welcome!",
          "You are currently playing Red Light Pink Light in sandbox mode.",
        ],
      },
      {
        words: ["You can only move when the north pole glows pink."],
      },
      {
        words: [
          "You'll get sent back to the start if you try to move when the north pole is red.",
        ],
      },
    ],
    victoryCondition: "Whoever reaches the top the most times wins!",
    statusDisplay: {
      type: "rankedscore",
    },
  },
]
