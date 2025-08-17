/**
 * Makes a standard request to the Firebase Auth REST API. AS all the
 * requests use the same authentication method, this function is used to
 * make the request.
 *
 * @param url - The URL to make the request to.
 * @param method - The HTTP method to use.
 * @param oauth2Token - The OAuth2 token to use for authentication.
 * @param body - The body of the request.
 * @returns The response from the request.
 */
export async function standardRequest(url: string, method: string, oauth2Token: string, body?: any) {
  return fetch(url, {
    method,
    body,
    headers: {
      Authorization: `Bearer ${oauth2Token}`,
    },
  });
}
