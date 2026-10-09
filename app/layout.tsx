import type { ReactNode } from "react";
import "./globals.css";
export const metadata={title:"Симфония",description:"Писание, толкования, вопросы и первоисточники"};
export default function Layout({children}:{children:ReactNode}){return <html lang="ru"><body>{children}</body></html>}