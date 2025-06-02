const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

// Game configuration
const GAME_CONFIG = {
  maxLevel: 8, // 0-8 makes 9 levels total
  baseSuccessChance: 0.9, // 90% at level 0
  chanceDecrement: 0.1 // Decreases by 10% each level
}

exports.tryLevel = functions.https.onCall(async (data, context) => {
  try {
    const currentLevel = parseInt(data.currentLevel) || 0
    // Validate input
    if (isNaN(currentLevel)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid level')
    }
    if (currentLevel < 0 || currentLevel > GAME_CONFIG.maxLevel) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Level must be between 0 and ${GAME_CONFIG.maxLevel}`
      )
    }

    // Calculate current success chance
    const successChance = GAME_CONFIG.baseSuccessChance - (currentLevel * GAME_CONFIG.chanceDecrement)
    const success = Math.random() < successChance

    let newLevel, status

    if (success) {
      newLevel = currentLevel + 1
      status = newLevel <= GAME_CONFIG.maxLevel
        ? `Advanced to level ${newLevel}`
        : 'You won! Enter your name.'
    } else {
      newLevel = 0
      status = 'Failed. Level reset.'
    }

    // Calculate next level's chance if not at max
    const nextChance = newLevel <= GAME_CONFIG.maxLevel
      ? Math.round((GAME_CONFIG.baseSuccessChance - (newLevel * GAME_CONFIG.chanceDecrement)) * 100)
      : 0

    return {
      success,
      newLevel,
      status,
      nextChance,
      currentChance: Math.round(successChance * 100)
    }
  } catch (error) {
    console.error('Error in tryLevel:', error)
    throw new functions.https.HttpsError('internal', 'Failed to process level attempt')
  }
})

exports.updateLastWin = functions.https.onCall(async (data, context) => {
  try {
    const playerName = (data.playerName || '').trim()

    if (!playerName) {
      throw new functions.https.HttpsError('invalid-argument', 'Name is required')
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp()

    await admin.firestore()
      .collection('levelCompletion')
      .doc('lastCompletion')
      .set({
        timestamp,
        name: playerName
      })

    return {success: true, message: 'Last win updated successfully'}
  } catch (error) {
    console.error('Error updating last win:', error)
    throw new functions.https.HttpsError('internal', 'Failed to update last win')
  }
})
