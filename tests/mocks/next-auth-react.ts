export async function signOut() {
  return { url: 'http://localhost/' }
}

export async function signIn() {
  return { ok: true, error: null, status: 200, url: 'http://localhost/' }
}
