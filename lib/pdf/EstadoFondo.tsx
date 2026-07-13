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

export interface EstadoFondoMes {
  mesLabel: string;
  saldoInicial: number;
  aportes: number;
  retiros: number;
  resultado: number;
  tasa: number; // fracción
  saldoFinal: number;
  tieneRendimiento: boolean;
  enCurso: boolean;
}

export interface EstadoFondoSocio {
  nombre: string;
  inactivo: boolean;
  capitalActual: number;
  participacion: number; // fracción
  totalAportado: number;
  totalRetirado: number;
  gananciaNeta: number;
  rentabilidad: number; // fracción
}

export interface EstadoFondoProps {
  fondoNombre: string;
  marca: string; // nombre del fondo/empresa (Brújula Markets)
  periodoLabel: string;
  generadoEl: string;
  resumen: {
    capitalActual: number;
    gananciaAcumulada: number;
    twrAnual: number;
    twrDesdeInicio: number;
    flotanteLabel: string | null; // "Julio 2026 en curso (+6.60%)" o null
  };
  socios: EstadoFondoSocio[];
  meses: EstadoFondoMes[];
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
    marginBottom: 16,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandText: { marginLeft: 10 },
  fondo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
  sub: { fontSize: 8, color: GRAY, letterSpacing: 2, textTransform: "uppercase" },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docMeta: { fontSize: 8, color: GRAY, textAlign: "right", marginTop: 2 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EADFCB",
  },
  summaryLabel: { fontSize: 7, color: GRAY, textTransform: "uppercase" },
  summaryValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 3 },

  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 4,
  },
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

  // Posiciones por socio
  sNombre: { width: "24%" },
  sNum: { width: "15.2%", textAlign: "right" },

  // Cuadro mensual
  mMes: { width: "19%" },
  mNum: { width: "16.2%", textAlign: "right" },

  nota: { fontSize: 7.5, color: GRAY, marginTop: 6 },
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

export function EstadoFondo({
  fondoNombre,
  marca,
  periodoLabel,
  generadoEl,
  resumen,
  socios,
  meses,
}: EstadoFondoProps) {
  return (
    <Document title={`Reporte del fondo · ${fondoNombre}`} author={marca}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <CompassMark />
            <View style={styles.brandText}>
              <Text style={styles.fondo}>{marca}</Text>
              <Text style={styles.sub}>Fondo compartido</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>{fondoNombre}</Text>
            <Text style={styles.docMeta}>{periodoLabel}</Text>
            <Text style={styles.docMeta}>Generado: {generadoEl}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Capital del fondo</Text>
            <Text style={styles.summaryValue}>{money(resumen.capitalActual)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ganancia acumulada</Text>
            <Text
              style={[styles.summaryValue, { color: resumen.gananciaAcumulada >= 0 ? POS : NEG }]}
            >
              {moneySigned(resumen.gananciaAcumulada)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Rendimiento del año (TWR)</Text>
            <Text style={[styles.summaryValue, { color: resumen.twrAnual >= 0 ? POS : NEG }]}>
              {pct(resumen.twrAnual)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Desde el inicio (TWR)</Text>
            <Text
              style={[styles.summaryValue, { color: resumen.twrDesdeInicio >= 0 ? POS : NEG }]}
            >
              {pct(resumen.twrDesdeInicio)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Posición por socio</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.sNombre]}>Socio</Text>
          <Text style={[styles.th, styles.sNum]}>Capital</Text>
          <Text style={[styles.th, styles.sNum]}>% Fondo</Text>
          <Text style={[styles.th, styles.sNum]}>Aportado</Text>
          <Text style={[styles.th, styles.sNum]}>Retiros</Text>
          <Text style={[styles.th, styles.sNum]}>Ganancia</Text>
        </View>
        {socios.map((s, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={[styles.td, styles.sNombre]}>
              {s.nombre}
              {s.inactivo ? " (salió)" : ""}
            </Text>
            <Text style={[styles.td, styles.sNum, { fontFamily: "Helvetica-Bold" }]}>
              {money(s.capitalActual)}
            </Text>
            <Text style={[styles.td, styles.sNum]}>{(s.participacion * 100).toFixed(2)}%</Text>
            <Text style={[styles.td, styles.sNum]}>{money(s.totalAportado)}</Text>
            <Text style={[styles.td, styles.sNum]}>{money(s.totalRetirado)}</Text>
            <Text style={[styles.td, styles.sNum, { color: s.gananciaNeta >= 0 ? POS : NEG }]}>
              {moneySigned(s.gananciaNeta)} ({pct(s.rentabilidad)})
            </Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Cuadro histórico mensual</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.mMes]}>Mes</Text>
          <Text style={[styles.th, styles.mNum]}>Cap. inicial</Text>
          <Text style={[styles.th, styles.mNum]}>Aportes</Text>
          <Text style={[styles.th, styles.mNum]}>Retiros</Text>
          <Text style={[styles.th, styles.mNum]}>Resultado</Text>
          <Text style={[styles.th, styles.mNum]}>Cap. final</Text>
        </View>
        {meses.map((m, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={[styles.td, styles.mMes]}>
              {m.mesLabel}
              {m.enCurso ? " *" : ""}
            </Text>
            <Text style={[styles.td, styles.mNum]}>{money(m.saldoInicial)}</Text>
            <Text style={[styles.td, styles.mNum]}>{m.aportes > 0 ? money(m.aportes) : "—"}</Text>
            <Text style={[styles.td, styles.mNum]}>{m.retiros > 0 ? money(m.retiros) : "—"}</Text>
            <Text
              style={[
                styles.td,
                styles.mNum,
                { color: !m.tieneRendimiento ? GRAY : m.resultado >= 0 ? POS : NEG },
              ]}
            >
              {m.tieneRendimiento ? `${moneySigned(m.resultado)} (${pct(m.tasa)})` : "—"}
            </Text>
            <Text style={[styles.td, styles.mNum, { fontFamily: "Helvetica-Bold" }]}>
              {money(m.saldoFinal)}
            </Text>
          </View>
        ))}

        {resumen.flotanteLabel && (
          <Text style={styles.nota}>
            * {resumen.flotanteLabel}: resultado flotante del mes en curso, variable hasta el
            cierre. El capital del fondo lo incluye.
          </Text>
        )}

        <Text style={styles.disclaimer}>
          Reporte del fondo compartido emitido por {marca}. TWR: rendimiento de la gestión por
          composición mensual; no depende de aportes ni retiros. Rendimientos pasados no
          garantizan resultados futuros.
        </Text>
      </Page>
    </Document>
  );
}
