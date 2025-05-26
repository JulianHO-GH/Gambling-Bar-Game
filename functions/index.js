const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

exports.tryLevel = functions.https.onCall(async (data, context) => {
  const maxLevel = 9
  const currentLevel = data.currentLevel || 0

  if (typeof currentLevel !== 'number' || currentLevel < 0 ||
      currentLevel > maxLevel) {
    throw new functions.https.HttpsError('invalid-argument', 'Nivel inválido')
  }

  const chance = (maxLevel - currentLevel) * 0.1
  const randomValue = Math.random()
  const success = randomValue < chance

  let newLevel = currentLevel
  let status = ''

  if (success) {
    if (currentLevel < maxLevel) {
      newLevel = currentLevel + 1
      status = `Avanzaste al nivel ${newLevel}`
    }
  } else {
    newLevel = 0
    status = 'Fallaste. Nivel reiniciado.'
  }

  if (newLevel === maxLevel) {
    status = '¡Ganaste! Ingresa tu nombre.'
  }

  return {
    success,
    newLevel,
    status,
    nextChance: newLevel < maxLevel ? (maxLevel - newLevel) * 10 : 0
  }
})

exports.updateLastWin = functions.https.onCall(async (data, context) => {
  const playerName = data.playerName
  if (typeof playerName !== 'string' || playerName.trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Nombre inválido')
  }

  const timestamp = admin.firestore.Timestamp.now()
  await admin.firestore()
    .collection('levelCompletion')
    .doc('lastCompletion')
    .set({
      timestamp,
      name: playerName
    })

  return {success: true, message: 'Última victoria actualizada'}
})
