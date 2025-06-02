const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

// Game configuration
const GAME_CONFIG = {
  maxLevel: 8,
  initialProbability: 0.9, // 90% chance at level 0
  probabilityStep: 0.1// Decreases by 10% each level
}

exports.attemptLevel = functions.https.onCall(async (data, context) => {
  // Validate session token if you implement authentication later
  const sessionToken = data.sessionToken || null

  // Validate current attempt data
  if (typeof data.currentAttempt !== 'object' || data.currentAttempt === null) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid attempt data structure')
  }

  const {level, clientSeed} = data.currentAttempt

  // Validate level
  if (typeof level !== 'number' || level < 0 || level > GAME_CONFIG.maxLevel) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Level must be between 0 and ${GAME_CONFIG.maxLevel}`
    )
  }

  // Validate client seed (could be used for more secure probability calculation)
  if (typeof clientSeed !== 'string' || clientSeed.length < 8) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid client verification seed'
    )
  }

  // Calculate current level probability
  const currentProbability = GAME_CONFIG.initialProbability - (level * GAME_CONFIG.probabilityStep)
  const serverSeed = generateServerSeed()
  const combinedSeed = `${clientSeed}:${serverSeed}`

  // Generate deterministic outcome based on combined seeds
  const outcomeValue = generateDeterministicOutcome(combinedSeed)
  const success = outcomeValue < currentProbability

  // Prepare response
  const response = {
    success,
    serverSeed, // For verification purposes
    probability: Math.round(currentProbability * 100),
    nextLevel: success ? Math.min(level + 1, GAME_CONFIG.maxLevel) : 0,
    isMaxLevel: success && level >= GAME_CONFIG.maxLevel - 1
  }

  // Add verification data if you want to prove fairness later
  response.verification = {
    combinedSeed,
    outcomeValue,
    threshold: currentProbability
  }

  return response
})

exports.recordWinner = functions.https.onCall(async (data, context) => {
  // Basic validation
  if (typeof data !== 'object' || data === null) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid data format')
  }

  const {playerName, finalLevel, verificationData} = data

  // Validate player name
  if (typeof playerName !== 'string' || playerName.trim().length < 2) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Player name must be at least 2 characters'
    )
  }

  // Validate level (optional, could verify against verificationData)
  if (typeof finalLevel !== 'number' || finalLevel !== GAME_CONFIG.maxLevel) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid completion level'
    )
  }

  // Store the winner with server timestamp
  try {
    await admin.firestore()
      .collection('winners')
      .doc('latest')
      .set({
        name: playerName.trim(),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        level: finalLevel,
        verified: Boolean(verificationData) // Could add more verification later
      })

    return {
      status: 'SUCCESS',
      message: 'Winner recorded successfully'
    }
  } catch (error) {
    console.error('Error recording winner:', error)
    throw new functions.https.HttpsError(
      'internal',
      'Failed to record winner'
    )
  }
})

// Helper functions for probability calculation
function generateServerSeed () {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15)
}

function generateDeterministicOutcome (seed) {
  // Simple hash function for demonstration
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash % 10000) / 10000
}
