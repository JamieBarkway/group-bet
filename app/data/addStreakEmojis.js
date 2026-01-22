const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'picks.json');

function addStreakEmojis() {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const users = JSON.parse(raw);

  const updatedUsers = users.map(user => {
    const enhancedResults = [];
    let currentStreak = 0;
    let currentType = null;

    for (const result of user.results) {
      if (result === currentType) {
        currentStreak++;
      } else {
        currentStreak = 1;
        currentType = result;
      }

      let emoji = null;
      if (currentStreak >= 3) {
        const baseEmoji = result === 'W' ? '🔥' : '😡';
        emoji = currentStreak >= 6 ? baseEmoji + baseEmoji : baseEmoji;
      }

      enhancedResults.push({
        outcome: result,
        emoji: emoji
      });
    }

    return {
      username: user.username,
      results: enhancedResults
    };
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(updatedUsers, null, 2));
  console.log('✅ Streak emojis added successfully!');
}

addStreakEmojis();
