import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Cro-mix Studio — AI Song Cover & Remix", description: "Create and plan music covers and remixes in a modern music studio." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="hr"><body>{children}</body></html>; }