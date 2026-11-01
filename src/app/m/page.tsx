import { redirect } from 'next/navigation';

/** /m → static mobile build (public/m/index.html). App-shell glue only —
 *  the mobile game itself lives exclusively in mobile/ (MIRROR rule). */
export default function MobileRedirect() {
  redirect('/m/index.html');
}
