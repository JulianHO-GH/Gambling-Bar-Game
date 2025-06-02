const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

// Game configuration - now with explicit probability curve
const GAME_CONFIG = {
  maxLevel: 8,
  probabilityCurve: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1] // Level 0 to 8
}

exports.tryLevel = functions.https.onCall(async (data, context) => {
  const currentLevel = parseInt(data.currentLevel, 10) || 0
  const clientSeed = data.clientSeed || Math.random().toString(36).substring(2, 15)
  const serverSeed = Math.random().toString(36).substring(2, 15)

  // Validate level
  if (currentLevel < 0 || currentLevel > GAME_CONFIG.maxLevel) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid level. Must be between 0 and ${GAME_CONFIG.maxLevel}`
    )
  }

  // Calculate combined hash for deterministic randomness
  const combinedSeed = clientSeed + serverSeed
  let hash = 0
  for (let i = 0; i < combinedSeed.length; i++) {
    hash = ((hash << 5) - hash) + combinedSeed.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  const normalizedRandom = (hash % 10000) / 10000 // 0-0.9999

  // Get current level probability
  const successProbability = GAME_CONFIG.probabilityCurve[currentLevel]
  const success = normalizedRandom < successProbability

  // Determine new level
  let newLevel = currentLevel
  let status = ''
  let isMaxLevel = false

  if (success) {
    newLevel = currentLevel + 1
    isMaxLevel = newLevel > GAME_CONFIG.maxLevel
    status = isMaxLevel
      ? 'You won! Enter your name.'
      : `Advanced to level ${newLevel}`
  } else {
    newLevel = 0
    status = 'Failed. Level reset.'
  }

  return {
    success,
    newLevel,
    status,
    currentChance: Math.round(successProbability * 100),
    nextChance: isMaxLevel
      ? 0
      : Math.round(GAME_CONFIG.probabilityCurve[newLevel] * 100),
    serverSeed // Send back for verification
  }
})

// (Keep the same updateLastWin function as before)
exports.updateLastWin = functions.https.onCall(async (data, context) => {
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
})
