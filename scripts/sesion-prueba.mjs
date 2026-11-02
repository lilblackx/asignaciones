// Las reglas exigen un inicio de sesión de hace menos de 24 horas (`request.auth.token.auth_time`, ver firestore.rules). Los contextos de las pruebas
// no lo traen, así que se les pone la hora de ahora, salvo que la prueba indique otra (`{ auth_time: ... }`) para probar sesiones vencidas.
export function conSesionReciente(testEnv) {
  const original = testEnv.authenticatedContext.bind(testEnv);
  testEnv.authenticatedContext = (uid, claims = {}) => original(uid, { auth_time: Math.floor(Date.now() / 1000), ...claims });
  return testEnv;
}
