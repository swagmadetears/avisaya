import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// El hotel que la persona tiene elegido arriba ('todos' o un id). Se guarda en el móvil y se
// comparte entre pestañas: si lo cambias en Averías, el chat y el historial lo siguen.
const oyentes = new Set<(v: string) => void>();
let actual: { clave: string; valor: string } | null = null;

export function useHotelElegido(perfilId: string | undefined) {
  const clave = perfilId ? `avisaya:hotel:${perfilId}` : '';
  const [valor, setValor] = useState(actual && actual.clave === clave ? actual.valor : '');

  useEffect(() => {
    if (!clave) return;
    const oir = (v: string) => setValor(v);
    oyentes.add(oir);
    if (!actual || actual.clave !== clave) {
      AsyncStorage.getItem(clave)
        .then((v) => {
          actual = { clave, valor: v ?? '' };
          oyentes.forEach((o) => o(actual!.valor));
        })
        .catch(() => {});
    }
    return () => {
      oyentes.delete(oir);
    };
  }, [clave]);

  const elegir = useCallback(
    (id: string) => {
      if (!clave) return;
      actual = { clave, valor: id };
      oyentes.forEach((o) => o(id));
      AsyncStorage.setItem(clave, id).catch(() => {});
    },
    [clave],
  );

  return [valor, elegir] as const;
}
