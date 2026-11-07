# US Drought Monitor

El nivel de sequía de su condado de EE. UU., según el **US Drought Monitor**
(USDM), el mapa semanal de la sequía en Estados Unidos elaborado por el
National Drought Mitigation Center (Universidad de Nebraska-Lincoln), el USDA y
la NOAA. Un dispositivo por condado seguido, con su categoría de sequía, la
parte del condado en cada categoría y la evolución en 1 y 4 semanas;
disparadores de escena cuando la sequía empeora, alcanza un nivel o mejora; una
frase lista para una notificación; y un widget con los colores del mapa del
USDM.

El USDM describe la sequía; **no fija las restricciones de agua**: las decide
su ciudad, su condado o su distribuidor de agua.

## Lo que obtiene

- un dispositivo por condado, con su nivel (0 a 5), su categoría («D2 ·
  Sequía severa»), la parte del condado en D1 o peor, D2 o peor, D3 o peor y
  D4, la evolución en 1 y 4 semanas y la fecha del mapa;
- tres disparadores de escena: la sequía empeora, alcanza un nivel, mejora;
- una acción de escena que devuelve el último mapa en una frase;
- un widget con la parte de cada categoría en una franja de colores, con los
  colores oficiales del USDM.

## Requisitos

- Gladys Assistant 5.3 o posterior.
- Acceso a Internet desde Gladys (servicios de datos del USDM, sin cuenta ni
  clave).
- El código FIPS de 5 cifras de su condado (ver más abajo).

## Configuración

1. Busque el código FIPS de su condado: 2 cifras para el estado, 3 para el
   condado. Harris County (Texas) es 48201; Los Angeles County (California), 06037. El US Census los lista todos
   (https://www.census.gov/library/reference/code-lists/ansi.html), y una
   búsqueda de «FIPS code» con el nombre del condado también lo da.
2. En la pestaña **Configuración**, escriba los códigos, separados por comas,
   y guarde.
3. Cree los dispositivos en la pestaña **Descubrir**.

### Ajustes

- **Códigos FIPS de los condados** — 10 condados como máximo. Un código que el
  USDM no conoce se indica en el estado de la integración, y no se ofrece
  ningún dispositivo para él. Un código de 4 cifras se lee con un cero delante
  (6037 es 06037).
- **Parte necesaria para una categoría** — el nivel de un condado es la
  categoría más fuerte que cubre al menos esta parte de su superficie, 1 % por
  defecto. El USDM dibuja sus categorías en un mapa: en un condado grande, una
  franja estrecha de D3 en un borde dice poco de su casa. Elija «Cualquier
  parte» para seguir la categoría más fuerte que toca el condado, o una parte
  mayor para seguir la mayor parte del condado.
- **Idioma de los nombres de las funciones** — nombres de las nuevas funciones
  e idioma de sus textos (categorías, evoluciones, fechas, variables de escena
  y resumen).

## Dispositivos

| Función                    | Contenido                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Nivel de sequía (0–5)      | 0 sin sequía, 1 D0 anormalmente seco, 2 D1 moderada, 3 D2 severa, 4 D3 extrema, 5 D4 excepcional |
| Categoría de sequía        | «D2 · Sequía severa», «Sin sequía»                                                               |
| Superficie en D1 o peor    | parte del condado en sequía, en %                                                                |
| Superficie en D2/D3 o peor | parte del condado en D2 o peor, en D3 o peor, en %                                               |
| Superficie en D4           | parte del condado en sequía excepcional, en %                                                    |
| Evolución en 1 / 4 semanas | «D1 → D2, empeora · D1+ +12,5 pts»: niveles, y evolución de la parte D1+ en puntos               |
| Fecha del mapa             | el martes que describe el mapa                                                                   |

D0 (anormalmente seco) no es una sequía para el USDM: marca una zona que entra
en sequía o sale de ella. Aquí es un nivel propio.

Las partes siguen al USDM: «D2 o peor» incluye D3 y D4. El nivel, la categoría
y las partes conservan su historial.

## Widget del panel

**Sequía (EE. UU.)**: el condado elegido (o el primero seguido), con su nombre
en Gladys, una franja dividida según la parte de cada categoría con los colores
de la leyenda del USDM (rojo oscuro D4, rojo D3, naranja D2, beige D1, amarillo
D0, gris sin sequía), la categoría, las partes, las evoluciones y la fecha del
mapa. Cada bloque puede ocultarse en los ajustes del widget.

## Disparadores de escena

- **La sequía empeora** — un nuevo mapa semanal sitúa el condado en una
  categoría más fuerte que el mapa anterior.
- **La sequía alcanza un nivel** — un nuevo mapa sitúa el condado en la
  categoría elegida (D0 a D4) o una más fuerte, cuando antes estaba por debajo.
- **La sequía mejora** — un nuevo mapa sitúa el condado en una categoría más
  débil.

Cada disparador puede limitarse a un condado. Se activan una vez por nuevo mapa
(los jueves), nunca con el primer mapa leído, que solo sirve de referencia.
Variables: condado, categoría (none, D0 a D4), categoría anterior, nombre de la
categoría, nivel (0–5), superficie en D1 o peor, fecha del mapa.

## Acción de escena

**Sequía: obtener el mapa del condado en una frase** devuelve, para el condado
elegido (o el primero seguido), una frase como «Harris County, TX, mapa del 3
nov 2026: D3 · Sequía extrema, 83,2 % del condado en sequía (D1+). Peor que
hace 4 semanas.», además de la categoría, el nivel, las partes y la fecha del
mapa para las acciones siguientes.

## Ejemplos de escenas

- La sequía alcanza D2 → notificación «Piense en las restricciones de riego:
  consulte las normas de su ciudad.»
- Cada jueves por la tarde → obtener la frase y enviarla por Telegram.
- La sequía mejora → volver a poner el riego del jardín en su programa normal.

## Fuentes de datos, licencia y cuotas

- Servicios de datos del US Drought Monitor, `usdmdataservices.unl.edu`,
  estadísticas por condado en porcentaje de superficie. Sin cuenta, sin clave,
  sin cuota documentada.
- El mapa se dibuja con los datos del martes y se publica el jueves. La
  integración lee cada condado una vez al día, y cada 3 horas desde el jueves
  por la tarde (UTC) hasta que llega el nuevo mapa: unas pocas solicitudes por
  condado y por día.
- «The U.S. Drought Monitor is jointly produced by the National Drought
  Mitigation Center at the University of Nebraska-Lincoln, the United States
  Department of Agriculture, and the National Oceanic and Atmospheric
  Administration. Map courtesy of NDMC.»
- Sin afiliación con el US Drought Monitor, el NDMC, el USDA ni la NOAA.

## Solución de problemas

- **Ningún dispositivo en la pestaña Descubrir** — compruebe los códigos FIPS:
  un código que el USDM no conoce aparece en el estado de la integración.
- **Estado «no se pueden leer»** — los servicios de datos del USDM no
  responden; la integración lo intenta de nuevo cada hora y conserva el último
  mapa durante tres semanas.
- Registros: página de registros de la integración en Gladys; `LOG_LEVEL=debug`
  para el detalle de cada lectura.

## Límites

- Solo Estados Unidos, a nivel de condado (ni ciudad ni código postal).
- Datos semanales: el mapa del jueves describe el martes anterior.
- Las restricciones de agua no forman parte del USDM: consulte a su ciudad o a
  su distribuidor de agua.
- Tras tres semanas sin un nuevo mapa, los dispositivos dejan de recibir
  valores.
