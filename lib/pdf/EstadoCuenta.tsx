import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  Path,
} from "@react-pdf/renderer";

const NAVY = "#0A2540";
const GOLD = "#D4A574";
const CREAM = "#FAF7F2";
const POS = "#1E8E5A";
const NEG = "#C0392B";
const GRAY = "#6B7280";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (n: number) => usd.format(n);
const moneySigned = (n: number) => `${n > 0 ? "+" : ""}${usd.format(n)}`;
const pct = (f: number) => `${f > 0 ? "+" : ""}${(f * 100).toFixed(2)}%`;

export interface EstadoCuentaMes {
  mesLabel: string;
  saldoInicial: number;
  depositos: number;
  retiros: number;
  rendNeto: number;
  roiMes: number;
  saldoFinal: number;
  tieneRendimiento: boolean;
}

export interface EstadoCuentaProps {
  fondoNombre: string;
  cliente: { nombre: string; email: string; fechaIngreso: string };
  periodoLabel: string;
  generadoEl: string;
  meses: EstadoCuentaMes[];
  resumen: {
    saldoActual: number;
    gananciaNeta: number;
    roiAcumulado: number;
    aporteNeto: number;
  };
  /** Dónde está la comisión respecto del saldo: cambia el texto legal del pie. */
  tratamientoComision?: "descontada" | "ya_retirada" | "pagada_aparte";
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: NAVY, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 12,
    marginBottom: 18,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandText: { marginLeft: 10 },
  fondo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
  sub: { fontSize: 8, color: GRAY, letterSpacing: 2, textTransform: "uppercase" },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docMeta: { fontSize: 8, color: GRAY, textAlign: "right", marginTop: 2 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  infoBlock: { flexDirection: "column" },
  infoLabel: { fontSize: 7, color: GRAY, textTransform: "uppercase", letterSpacing: 1 },
  infoValue: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 1 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  summaryCard: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EADFCB",
  },
  summaryLabel: { fontSize: 7, color: GRAY, textTransform: "uppercase" },
  summaryValue: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 3 },

  tableHead: {
    flexDirection: "row",
    backgroundColor: NAVY,
    color: CREAM,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  td: { fontSize: 8.5 },
  cMes: { width: "22%" },
  cNum: { width: "15.6%", textAlign: "right" },

  disclaimer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: GRAY,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
});

function CompassMark() {
  return (
    <Svg width={34} height={34} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="30" stroke={GOLD} strokeWidth={2.5} fill={NAVY} />
      <Path d="M32 10 L37 32 L32 30 Z" fill={GOLD} />
      <Path d="M32 54 L27 32 L32 34 Z" fill={CREAM} />
      <Path d="M10 32 L32 27 L30 32 Z" fill={CREAM} />
      <Path d="M54 32 L32 37 L34 32 Z" fill={GOLD} />
      <Circle cx="32" cy="32" r="3.2" fill={GOLD} />
    </Svg>
  );
}

export function EstadoCuenta({
  fondoNombre,
  cliente,
  periodoLabel,
  generadoEl,
  meses,
  resumen,
  tratamientoComision = "descontada",
}: EstadoCuentaProps) {
  return (
    <Document title={`Estado de cuenta · ${cliente.nombre}`} author={fondoNombre}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <CompassMark />
            <View style={styles.brandText}>
              <Text style={styles.fondo}>{fondoNombre}</Text>
              <Text style={styles.sub}>Bitácora</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>Estado de cuenta</Text>
            <Text style={styles.docMeta}>{periodoLabel}</Text>
            <Text style={styles.docMeta}>Generado: {generadoEl}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Inversionista</Text>
            <Text style={styles.infoValue}>{cliente.nombre}</Text>
            <Text style={{ fontSize: 8, color: GRAY }}>{cliente.email}</Text>
          </View>
          <View style={[styles.infoBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.infoLabel}>Cliente desde</Text>
            <Text style={styles.infoValue}>{cliente.fechaIngreso}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saldo actual</Text>
            <Text style={styles.summaryValue}>{money(resumen.saldoActual)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{tratamientoComision === "pagada_aparte" ? "Resultado" : "Ganancia neta"}</Text>
            <Text style={[styles.summaryValue, { color: resumen.gananciaNeta >= 0 ? POS : NEG }]}>
              {moneySigned(resumen.gananciaNeta)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>ROI acumulado</Text>
            <Text style={[styles.summaryValue, { color: resumen.roiAcumulado >= 0 ? POS : NEG }]}>
              {pct(resumen.roiAcumulado)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Aporte neto</Text>
            <Text style={styles.summaryValue}>{money(resumen.aporteNeto)}</Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.cMes]}>Mes</Text>
          <Text style={[styles.th, styles.cNum]}>Saldo inicial</Text>
          <Text style={[styles.th, styles.cNum]}>Depósitos</Text>
          <Text style={[styles.th, styles.cNum]}>Retiros</Text>
          <Text style={[styles.th, styles.cNum]}>Resultado</Text>
          <Text style={[styles.th, styles.cNum]}>Saldo final</Text>
        </View>

        {meses.map((m, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={[styles.td, styles.cMes]}>{m.mesLabel}</Text>
            <Text style={[styles.td, styles.cNum]}>{money(m.saldoInicial)}</Text>
            <Text style={[styles.td, styles.cNum]}>{m.depositos > 0 ? money(m.depositos) : "—"}</Text>
            <Text style={[styles.td, styles.cNum]}>{m.retiros > 0 ? money(m.retiros) : "—"}</Text>
            <Text style={[styles.td, styles.cNum, { color: m.rendNeto >= 0 ? POS : NEG }]}>
              {m.tieneRendimiento ? `${moneySigned(m.rendNeto)} (${pct(m.roiMes)})` : "—"}
            </Text>
            <Text style={[styles.td, styles.cNum, { fontFamily: "Helvetica-Bold" }]}>
              {money(m.saldoFinal)}
            </Text>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Este documento es un estado de cuenta informativo emitido por {fondoNombre}.{" "}
          {tratamientoComision === "pagada_aparte"
            ? "Los montos mostrados son el resultado de la cuenta y los saldos son los de la cuenta real; la comisión del operador se liquida por separado y no está descontada aquí."
            : tratamientoComision === "ya_retirada"
              ? "Los montos mostrados son el resultado neto del inversionista: la comisión del operador ya está descontada de los saldos."
              : "Los montos mostrados son el resultado neto del inversionista."}{" "}
          Rendimientos pasados no garantizan resultados futuros. Para cualquier aclaración, contacte
          a su asesor.
        </Text>
      </Page>
    </Document>
  );
}
