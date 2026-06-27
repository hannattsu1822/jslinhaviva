import type { ParsedReleData } from "./types";

export function extractDeviceIdFromBinary(data: Buffer): string {
  return Buffer.from(data).toString("hex");
}

export function parseReleResponse(metResponse: string, tempResponse: string): ParsedReleData {
  const data: ParsedReleData = {};

  try {
    const getValue = (regex: RegExp, text: string): number | null => {
      const match = text.match(regex);
      return match ? parseFloat(match[1]) : null;
    };

    const getValues = (regex: RegExp, text: string): number[] => {
      const match = text.match(regex);
      return match ? match.slice(1).map(parseFloat) : [];
    };

    const currents = getValues(
      /Current Magnitude \(A\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/,
      metResponse
    );
    if (currents.length === 3) {
      data.corrente_r = currents[0];
      data.corrente_s = currents[1];
      data.corrente_t = currents[2];
    }

    const voltagesPhaseBlock = metResponse.match(
      /VA\s+VB\s+VC\s+VG\s*\n\s*Voltage Magnitude \(V\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/
    );
    if (voltagesPhaseBlock) {
      data.tensao_rn = parseFloat(voltagesPhaseBlock[1]);
      data.tensao_sn = parseFloat(voltagesPhaseBlock[2]);
      data.tensao_tn = parseFloat(voltagesPhaseBlock[3]);
    }

    const voltagesLineBlock = metResponse.match(
      /VAB\s+VBC\s+VCA\s*\n\s*Voltage Magnitude \(V\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/
    );
    if (voltagesLineBlock) {
      data.tensao_rs = parseFloat(voltagesLineBlock[1]);
      data.tensao_st = parseFloat(voltagesLineBlock[2]);
      data.tensao_tr = parseFloat(voltagesLineBlock[3]);
    }

    data.frequencia = getValue(/Frequency \(Hz\)\s*=\s*([\d.]+)/, metResponse);
    data.temperatura_dispositivo = getValue(/AMBT \(deg\. C\)\s*:\s*([\d.]+)/, tempResponse);
    data.temperatura_ambiente = getValue(/AMBT \(deg\. C\)\s*:\s*([\d.]+)/, tempResponse);
    data.temperatura_enrolamento = getValue(/TOILC \(deg\. C\)\s*:\s*([\d.]+)/, tempResponse);
  } catch {
    // resposta parcial ou formato inesperado
  }

  return data;
}
