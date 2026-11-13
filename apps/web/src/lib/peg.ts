/**
 * Hand-off between the sign-in Peg and the app's Peg: set when sign-in or sign-up
 * succeeds, read once (and removed) by the app header to greet the user.
 */
export const GREET_KEY = "detent:greet";
export type Greeting = "signin" | "signup";
