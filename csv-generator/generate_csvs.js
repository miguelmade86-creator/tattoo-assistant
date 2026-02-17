import fs from "fs";
import { v4 as uuid } from "uuid";

// ======== 1️⃣ Studios ========
const studios = [
  { name: "Ink Masters", address: "Av. Siempre Viva 123", whatsapp: "+34123456789" },
  { name: "Tattoo House", address: "Calle Luna 45", whatsapp: "+34678901234" },
  { name: "Black Ink", address: "Calle Sol 99", whatsapp: "+34666677788" },
].map(s => ({ id: uuid(), ...s }));

fs.writeFileSync("studios.csv", "id,name,address,whatsapp_number\n" + studios.map(s => `${s.id},${s.name},${s.address},${s.whatsapp}`).join("\n"));

// ======== 2️⃣ Profiles ========
const profiles = [
  { role: "studio_admin", studioIndex: 0, name: "Alejandro Moreno", email: "alejandro@inkmasters.com" },
  { role: "artist", studioIndex: 0, name: "Laura Sanchez", email: "laura@inkmasters.com" },
  { role: "artist", studioIndex: 1, name: "Juan Perez", email: "juan@tattoohouse.com" },
  { role: "studio_admin", studioIndex: 1, name: "Sofia Ruiz", email: "sofia@tattoohouse.com" },
  { role: "artist", studioIndex: 2, name: "Maria Gonzalez", email: "maria@blackink.com" },
  { role: "studio_admin", studioIndex: 2, name: "Carlos Diaz", email: "carlos@blackink.com" },
].map(p => ({ id: uuid(), ...p, studio_id: studios[p.studioIndex].id }));

fs.writeFileSync("profiles.csv", "id,role,studio_id,name,email\n" + profiles.map(p => `${p.id},${p.role},${p.studio_id},${p.name},${p.email}`).join("\n"));

// ======== 3️⃣ Clients ========
const clients = [
  { name: "Carlos Gomez", phone: "+34600111222", consent: true },
  { name: "Laura Martinez", phone: "+34600333444", consent: true },
  { name: "Pedro Ramirez", phone: "+34600555666", consent: false },
  { name: "Ana Lopez", phone: "+34600777888", consent: true },
  { name: "Lucia Fernandez", phone: "+34600999000", consent: false },
  { name: "David Sanchez", phone: "+34600122334", consent: true },
].map(c => ({ id: uuid(), ...c }));

fs.writeFileSync("clients.csv", "id,name,phone,consent_whatsapp\n" + clients.map(c => `${c.id},${c.name},${c.phone},${c.consent}`).join("\n"));

// ======== 4️⃣ Appointments ========
const appointments = [
  { artistIndex: 1, clientIndex: 0, start: "2026-02-06T16:00:00Z", end: "2026-02-06T18:00:00Z", type: "Fine Line", body: "Brazo", price: 120, notes: "Diseño minimalista en brazo derecho", sent: false },
  { artistIndex: 1, clientIndex: 1, start: "2026-02-07T10:00:00Z", end: "2026-02-07T12:00:00Z", type: "Realism", body: "Pierna", price: 250, notes: "Retrato estilo realista", sent: false },
  { artistIndex: 2, clientIndex: 2, start: "2026-02-06T14:00:00Z", end: "2026-02-06T16:00:00Z", type: "Lettering", body: "Antebrazo", price: 80, notes: "Frase motivacional", sent: false },
  { artistIndex: 2, clientIndex: 3, start: "2026-02-08T09:00:00Z", end: "2026-02-08T11:00:00Z", type: "Tribal", body: "Hombro", price: 150, notes: "Tribal tradicional", sent: false },
  { artistIndex: 4, clientIndex: 4, start: "2026-02-05T15:00:00Z", end: "2026-02-05T17:00:00Z", type: "Old School", body: "Brazo", price: 100, notes: "Calavera clásica", sent: true },
  { artistIndex: 4, clientIndex: 5, start: "2026-02-09T11:00:00Z", end: "2026-02-09T13:00:00Z", type: "Watercolor", body: "Espalda", price: 300, notes: "Acuarela grande", sent: false },
].map(a => ({ 
  id: uuid(), 
  ...a, 
  artist_id: profiles[a.artistIndex].id, 
  client_id: clients[a.clientIndex].id,
  google_event_id: `evt_${Math.floor(Math.random()*1000)}`
}));

fs.writeFileSync("appointments.csv", "id,artist_id,client_id,start_time,end_time,tattoo_type,body_part,price,notes,google_event_id,reminder_sent\n" + appointments.map(a => `${a.id},${a.artist_id},${a.client_id},${a.start},${a.end},${a.type},${a.body},${a.price},"${a.notes}",${a.google_event_id},${a.sent}`).join("\n"));

// ======== 5️⃣ Google Accounts (dummy) ========
const google_accounts = [1,2,4].map(i => ({
  user_id: profiles[i].id,
  access_token: `ya29.a0AfH6SMCexampletoken${i}`,
  refresh_token: `1//0gEXAMPLEREFRESH${i}`,
  scope: "https://www.googleapis.com/auth/calendar.readonly",
  token_type: "Bearer",
  expiry_date: "2026-02-05T23:59:59Z"
}));

fs.writeFileSync("google_accounts.csv", "user_id,access_token,refresh_token,scope,token_type,expiry_date\n" + google_accounts.map(g => `${g.user_id},${g.access_token},${g.refresh_token},${g.scope},${g.token_type},${g.expiry_date}`).join("\n"));

console.log("✅ Todos los CSVs generados correctamente!");
