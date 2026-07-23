/**
 * Contoh handler command interactive button (Baileys style)
 *
 * Cara pakai:
 * 1) Import file ini ke handler utama bot kamu.
 * 2) Panggil handleOwnerButtonCommand(...) pada event pesan masuk.
 * 3) Panggil handleButtonReply(...) untuk tangani balasan tombol.
 */

async function handleOwnerButtonCommand({ m, conn, globalPrefix = "." }) {
  // Hanya owner (pesan dari diri sendiri), command: "button"
  if (!m?.itsMe) return false;

  const textIn = (m?.text || m?.body || "").trim().toLowerCase();
  if (textIn !== "button") return false;

  const text = "Hallo ini pesan dari button";

  const buttons = [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "Klik saya",
        id: `${globalPrefix}button_reply`,
      }),
    },
  ];

  await conn.sendMessage(
    m.chat,
    {
      text,
      footer: "Silakan pilih tombol",
      buttons,
      headerType: 1,
    },
    { quoted: m }
  );

  return true;
}

async function handleButtonReply({ m, conn, globalPrefix = "." }) {
  const textIn = (m?.text || m?.body || "").trim().toLowerCase();
  const expected = `${globalPrefix}button_reply`.toLowerCase();

  // Tangani saat user menekan quick reply
  if (textIn !== expected) return false;

  await conn.sendMessage(
    m.chat,
    {
      text: "Mantap, tombolnya sudah berhasil ditekan.",
    },
    { quoted: m }
  );

  return true;
}

module.exports = {
  handleOwnerButtonCommand,
  handleButtonReply,
};
