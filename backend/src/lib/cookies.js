import { env } from '../config/env.js';

export const STUDENT_COOKIE = 'nsedu_student';
export const ADMIN_COOKIE = 'nsedu_admin';
export const STUDENT_SESSION_SECONDS = 7 * 24 * 60 * 60;
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

const base = (sameSite) => ({ httpOnly: true, sameSite, secure: env.isProduction, path: '/' });

export const studentCookieOptions = () => ({ ...base('lax'), maxAge: STUDENT_SESSION_SECONDS * 1000 });
export const adminCookieOptions = () => ({ ...base('strict'), maxAge: ADMIN_SESSION_SECONDS * 1000 });
export const clearStudentCookie = (response) => response.clearCookie(STUDENT_COOKIE, base('lax'));
export const clearAdminCookie = (response) => response.clearCookie(ADMIN_COOKIE, base('strict'));
