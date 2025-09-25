import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, Modal, ActivityIndicator,
  Alert, Linking, Image, ScrollView, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BRAND_PRIMARY = "#ff5a18";
const BRAND_DARK = "#444245";
const WEBHOOK = process.env.EXPO_PUBLIC_WEBHOOK_URL || "https://weebkarasek.farolbase.com/webhook/paranaappgrana";
const WHATSAPP_URL = process.env.EXPO_PUBLIC_WHATSAPP_URL || "https://wa.me/18998008009";
const HOWTO_IMG = process.env.EXPO_PUBLIC_HOWTO_IMAGE_URL || "https://gpakoffbuypbmfiwewka.supabase.co/storage/v1/object/public/Farol/Imagens%20de%20envio/Como%20autorizar%20aplicativo.jpg";

function onlyDigits(v) { return (v || "").replace(/\D+/g, ""); }
function isValidCPF(cpf) {
  const s = onlyDigits(cpf);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(s.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11; if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(s.substring(9, 10))) return false;
  soma = 0; for (let i = 1; i <= 10; i++) soma += parseInt(s.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11; if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(s.substring(10, 11));
}

async function postWebhook(action, body) {
  const r = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

export default function App() {
  // estado base
  const [cpf, setCpf] = useState("");
  const [logged, setLogged] = useState(false);
  const [loading, setLoading] = useState(false);

  // menu/topo & modais
  const [menuOpen, setMenuOpen] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);

  // resposta servidor
  const [resp, setResp] = useState(null);           // {status, message, amount?, formalization_url?}
  const [popupOpen, setPopupOpen] = useState(false);
  const [withdrawMode, setWithdrawMode] = useState(false);

  // formulário de saque
  const [phone, setPhone] = useState("");
  const [bank, setBank] = useState("");
  const [agency, setAgency] = useState("");
  const [account, setAccount] = useState("");
  const [accType, setAccType] = useState("corrente"); // "corrente" | "poupanca"

  const cpfDigits = useMemo(() => onlyDigits(cpf), [cpf]);
  const cpfOk = useMemo(() => isValidCPF(cpfDigits), [cpfDigits]);

  // carregar CPF salvo
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("cpf");
      if (saved) {
        setCpf(saved);
        setLogged(true);
      }
    })();
  }, []);

  // helpers UI
  const TopBar = () => (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: BRAND_DARK }}>GranaCred</Text>
      <Pressable onPress={() => setMenuOpen(true)} style={{ padding: 8 }}>
        <Text style={{ fontSize: 22, color: BRAND_DARK }}>⋯</Text>
      </Pressable>
    </View>
  );

  async function doCheckSaldo() {
    if (!cpfOk) { Alert.alert("CPF inválido", "Confira o número informado."); return; }
    try {
      setLoading(true);
      const data = await postWebhook("check", { cpf: cpfDigits });
      setResp(data);
      setPopupOpen(true);
      if (!logged) {
        await AsyncStorage.setItem("cpf", cpfDigits);
        setLogged(true);
      }
    } catch (e) {
      setResp({ status: "error", message: "Não foi possível consultar agora." });
      setPopupOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function doCheckStatus() {
    if (!cpfOk) { Alert.alert("CPF inválido", "Confira o número informado."); return; }
    try {
      setLoading(true);
      const data = await postWebhook("status", { cpf: cpfDigits });
      setResp(data);
      setPopupOpen(true);
    } catch (e) {
      setResp({ status: "error", message: "Status indisponível no momento." });
      setPopupOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function doWithdraw() {
    if (!cpfOk) { Alert.alert("CPF inválido"); return; }
    if (onlyDigits(phone).length < 10) { Alert.alert("Telefone inválido", "Informe DDD + número."); return; }
    if (!bank || !agency || !account) { Alert.alert("Dados bancários", "Preencha banco, agência e conta."); return; }

    try {
      setLoading(true);
      const data = await postWebhook("withdraw", {
        cpf: cpfDigits,
        phone: onlyDigits(phone).padStart(11, "0"),
        bank, agency, account, accountType: accType
      });
      // esperamos formalization_url do servidor:
      setResp({ ...data, status: data.status || "eligible" });
      setWithdrawMode(false);
      setPopupOpen(true);
    } catch (e) {
      Alert.alert("Não foi possível enviar o saque agora.");
    } finally {
      setLoading(false);
    }
  }

  function openWhatsApp(url = WHATSAPP_URL) {
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => Alert.alert("Não foi possível abrir o WhatsApp."));
    }
  }

  function indicateAndEarn() {
    const msg = encodeURIComponent("Oi! Usei o app GranaCred para consultar/sacar FGTS. Recomendo! ✅");
    openWhatsApp(`${WHATSAPP_URL}?text=${msg}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <TopBar />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 }}>
        <Text style={{ color: BRAND_DARK, fontSize: 26, fontWeight: "800", marginBottom: 8 }}>
          Seja bem-vindo à GranaCred
        </Text>
        <Text style={{ color: BRAND_DARK, opacity: 0.8, fontSize: 16, marginBottom: 24 }}>
          Seu FGTS na palma da mão.
        </Text>

        {/* CPF */}
        <Text style={{ color: BRAND_DARK, fontWeight: "600", marginBottom: 8 }}>CPF</Text>
        <TextInput
          placeholder="Digite seu CPF"
          keyboardType="numeric"
          value={cpf}
          onChangeText={setCpf}
          style={{
            borderWidth: 1,
            borderColor: cpf.length > 0 && !cpfOk ? "#e11d48" : "#d1d5db",
            borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16
          }}
        />

        {/* Botão Consultar saldo (sempre visível) */}
        <Pressable
          onPress={doCheckSaldo}
          disabled={loading || !cpfOk}
          style={{
            marginTop: 16,
            backgroundColor: (loading || !cpfOk) ? "#fbbf24" : BRAND_PRIMARY,
            paddingVertical: 14, borderRadius: 999, alignItems: "center"
          }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Consultar saldo</Text>}
        </Pressable>

        {/* Quando “logado” por CPF, mostrar os 3 atalhos */}
        {logged && (
          <View style={{ marginTop: 24, gap: 12 }}>
            <Pressable onPress={doCheckSaldo} style={{ borderWidth: 1, borderColor: "#e5e7eb", paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: BRAND_DARK, fontWeight: "700" }}>Consultar saldo</Text>
            </Pressable>
            <Pressable onPress={doCheckStatus} style={{ borderWidth: 1, borderColor: "#e5e7eb", paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: BRAND_DARK, fontWeight: "700" }}>Consultar status da proposta</Text>
            </Pressable>
            <Pressable onPress={indicateAndEarn} style={{ borderWidth: 1, borderColor: "#e5e7eb", paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: BRAND_DARK, fontWeight: "700" }}>Indique e ganhe</Text>
            </Pressable>
          </View>
        )}

        <Text style={{ marginTop: 24, color: "#6b7280", fontSize: 12 }}>
          Ao continuar, você concorda com os Termos de Uso da GranaCred.
        </Text>
      </ScrollView>

      {/* MENU (⋯) */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }} onPress={() => setMenuOpen(false)}>
          <View style={{ position: "absolute", top: 56, right: 12, backgroundColor: "#fff", borderRadius: 12, padding: 8, elevation: 6, shadowColor: "#000" }}>
            <Pressable onPress={() => { setMenuOpen(false); Alert.alert("Admin", "Tela de login do admin (V1 enxuto)."); }} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text style={{ color: BRAND_DARK }}>Admin (login)</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: "#e5e7eb" }} />
            <Pressable onPress={() => { setMenuOpen(false); openWhatsApp(); }} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text style={{ color: BRAND_DARK }}>Falar no WhatsApp</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* POPUP PRINCIPAL */}
      <Modal visible={popupOpen} transparent animationType="slide" onRequestClose={() => setPopupOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "85%" }}>
            {!withdrawMode ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: "800", color: BRAND_DARK, marginBottom: 8 }}>
                  {resp?.status === "eligible" ? "Saldo disponível"
                    : resp?.status === "pending_authorization" ? "Autorização necessária"
                    : resp?.status === "not_eligible" ? "Sem saldo no momento"
                    : "Aviso"}
                </Text>
                <ScrollView style={{ marginBottom: 12 }}>
                  <Text style={{ color: BRAND_DARK, marginBottom: 12 }}>{resp?.message ?? "—"}</Text>
                  {resp?.status === "eligible" && typeof resp?.amount === "number" && (
                    <Text style={{ color: BRAND_DARK, fontWeight: "700", marginBottom: 12 }}>
                      Valor: R$ {resp.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                  {/* formalização */}
                  {resp?.formalization_url && (
                    <Pressable onPress={() => (Platform.OS === "web" ? window.open(resp.formalization_url, "_blank") : Linking.openURL(resp.formalization_url))} style={{ borderWidth: 1, borderColor: "#e5e7eb", paddingVertical: 12, borderRadius: 12, alignItems: "center", marginBottom: 12 }}>
                      <Text style={{ color: BRAND_DARK, fontWeight: "700" }}>Abrir formalização</Text>
                    </Pressable>
                  )}
                </ScrollView>

                {/* Botões do popup */}
                <View style={{ gap: 8 }}>
                  {resp?.status === "eligible" && !resp?.formalization_url && (
                    <Pressable onPress={() => setWithdrawMode(true)} style={{ backgroundColor: BRAND_PRIMARY, paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontWeight: "700" }}>Sacar</Text>
                    </Pressable>
                  )}

                  {resp?.status === "pending_authorization" && (
                    <>
                      <Pressable onPress={doCheckStatus} style={{ backgroundColor: BRAND_PRIMARY, paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "700" }}>Já autorizei (reverificar)</Text>
                      </Pressable>
                      <Pressable onPress={() => setHowtoOpen(true)} style={{ borderWidth: 1, borderColor: "#e5e7eb", paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
                        <Text style={{ color: BRAND_DARK, fontWeight: "700" }}>Passos para autorizar</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Quando já houver formalization_url, mostramos "Concluir" que chama status */}
                  {resp?.formalization_url && (
                    <Pressable onPress={doCheckStatus} style={{ backgroundColor: BRAND_PRIMARY, paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontWeight: "700" }}>Concluir</Text>
                    </Pressable>
                  )}

                  <Pressable onPress={() => setPopupOpen(false)} style={{ paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <Text style={{ color: BRAND_DARK, fontWeight: "600" }}>Fechar</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              // FORMULÁRIO DE SAQUE
              <>
                <Text style={{ fontSize: 18, fontWeight: "800", color: BRAND_DARK, marginBottom: 8 }}>Dados para saque</Text>
                <ScrollView style={{ marginBottom: 12 }}>
                  <Text style={{ color: BRAND_DARK, marginBottom: 8 }}>Telefone (DDD+Número)</Text>
                  <TextInput
                    placeholder="11999999999"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 12 }}
                  />

                  <Text style={{ color: BRAND_DARK, marginBottom: 8 }}>Banco</Text>
                  <TextInput placeholder="001 (Banco do Brasil), 237 (Bradesco)..." value={bank} onChangeText={setBank}
                    style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 12 }} />

                  <Text style={{ color: BRAND_DARK, marginBottom: 8 }}>Agência</Text>
                  <TextInput placeholder="0001" value={agency} onChangeText={setAgency} keyboardType="numeric"
                    style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 12 }} />

                  <Text style={{ color: BRAND_DARK, marginBottom: 8 }}>Conta</Text>
                  <TextInput placeholder="123456-7" value={account} onChangeText={setAccount} keyboardType="numeric"
                    style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 12 }} />

                  <Text style={{ color: BRAND_DARK, marginBottom: 8 }}>Tipo de conta</Text>
                  <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                    <Pressable onPress={() => setAccType("corrente")} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: accType === "corrente" ? BRAND_PRIMARY : "#d1d5db" }}>
                      <Text style={{ color: accType === "corrente" ? BRAND_PRIMARY : BRAND_DARK }}>Corrente</Text>
                    </Pressable>
                    <Pressable onPress={() => setAccType("poupanca")} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: accType === "poupanca" ? BRAND_PRIMARY : "#d1d5db" }}>
                      <Text style={{ color: accType === "poupanca" ? BRAND_PRIMARY : BRAND_DARK }}>Poupança</Text>
                    </Pressable>
                  </View>
                </ScrollView>

                <View style={{ gap: 8 }}>
                  <Pressable onPress={doWithdraw} disabled={loading}
                    style={{ backgroundColor: BRAND_PRIMARY, paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Sacar</Text>}
                  </Pressable>
                  <Pressable onPress={() => setWithdrawMode(false)} style={{ paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" }}>
                    <Text style={{ color: BRAND_DARK, fontWeight: "600" }}>Voltar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL COM IMAGEM DE PASSO A PASSO */}
      <Modal visible={howtoOpen} transparent animationType="fade" onRequestClose={() => setHowtoOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 16 }}>
          <ScrollView contentContainerStyle={{ alignItems: "center" }}>
            <Image source={{ uri: HOWTO_IMG }} style={{ width: 320, height: 560, resizeMode: "contain", backgroundColor: "#fff", borderRadius: 12 }} />
            <Pressable onPress={() => setHowtoOpen(false)} style={{ marginTop: 16, backgroundColor: BRAND_PRIMARY, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Fechar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
