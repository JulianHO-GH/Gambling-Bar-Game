const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

exports.tryLevel = functions.https.onCall(async (data, context) => {
  console.log('Datos recibidos:', JSON.stringify(data)); // <-- Añade esta línea
  const maxLevel = 8;
  const currentLevel = Number(data?.currentLevel) || 0;

  console.log('--- tryLevel v20250602 ---'); // Actualiza la versión
  console.log(`Input: currentLevel=${currentLevel}, type=${typeof currentLevel}, raw=${data?.currentLevel}, fullData=${JSON.stringify(data)}`);

  if (typeof currentLevel !== 'number' || currentLevel < 0 ||
      currentLevel > maxLevel || !Number.isInteger(currentLevel)) {
    console.log('Error: Nivel inválido')
    throw new functions.https.HttpsError('invalid-argument', 'Nivel inválido')
  }

  const chance = (9 - currentLevel) * 0.1
  const randomValue = Math.random()
  const success = randomValue < chance

  console.log(`chance=${chance}, randomValue=${randomValue}, success=${success}`)

  let newLevel = currentLevel
  let status = ''

  console.log(`Evaluando: success=${success}, currentLevel=${currentLevel}, maxLevel=${maxLevel}`)
  if (success) {
    newLevel = currentLevel < maxLevel ? currentLevel + 1 : maxLevel
    status = currentLevel < maxLevel ? `Avanzaste al nivel ${newLevel}` : '¡Ganaste! Ingresa tu nombre.'
    console.log(`Éxito: newLevel=${newLevel}, status=${status}`)
  } else {
    newLevel = 0
    status = 'Fallaste. Nivel reiniciado.'
    console.log(`Fallo: newLevel=${newLevel}, status=${status}`)
  }

  const nextChance = newLevel < maxLevel ? (9 - newLevel) * 10 : 0
  console.log(`Respuesta: success=${success}, newLevel=${newLevel}, status=${status}, nextChance=${nextChance}`)

  return {
    success,
    newLevel,
    status,
    nextChance
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
    .set({timestamp, name: playerName})

  return {success: true, message: 'Última victoria actualizada'}
})
