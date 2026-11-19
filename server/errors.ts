//An error carrying its own status reaches the client with its message; the
//global handler in server.ts answers everything else with a bare 500.
//On its own, away from http.ts: a module that only refuses input needs no auth.
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
