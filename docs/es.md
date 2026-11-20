# GeoNet

Siga desde Gladys los volcanes de Nueva Zelanda y los terremotos sentidos alrededor de su casa. Los datos
proceden de [GeoNet](https://www.geonet.org.nz/), el sistema de vigilancia de los riesgos geológicos de
Nueva Zelanda, gestionado por GNS Science. GeoNet clasifica cada volcán (o campo volcánico) dos veces:

- el **Volcanic Alert Level**, de 0 (sin agitación volcánica) a 5 (erupción volcánica mayor);
- el **código de color de aviación**, para los aviones: verde, amarillo, naranja, rojo.

También calcula la intensidad de cada terremoto de Nueva Zelanda en la escala de Mercalli modificada (MMI):
la fuerza con la que se siente, no solo su magnitud. Sin cuenta ni clave de API.

Es un complemento, no es un sistema de alerta de seguridad: en caso de emergencia, siga los avisos
oficiales y a la Protección Civil (Civil Defence). Sin afiliación con GeoNet ni con GNS Science.

**¿GeoNet o EMSC?** La [integración EMSC](https://github.com/guim31/gladys-emsc) cubre los terremotos del
mundo entero, por magnitud, con los testimonios de quienes los sintieron. GeoNet solo cubre Nueva Zelanda,
con los datos oficiales del país: la intensidad calculada por GeoNet y los niveles de alerta volcánica.

## Lo que obtiene

- Un **dispositivo por volcán seguido**: nivel de alerta (0 a 5), código de color de aviación, actividad
  (con las palabras de GeoNet) y distancia a su casa.
- Un dispositivo **Volcanes de Nueva Zelanda**: el nivel de alerta más alto del país, el número de volcanes
  en nivel 1 o más y el más activo.
- Un dispositivo **Terremotos sentidos**: magnitud, intensidad, distancia y lugar del último terremoto en
  un radio alrededor de su casa, y su número en las últimas 24 horas.
- Un **widget de panel**: el último terremoto sentido y sus volcanes, los más activos primero.
- Dos **disparadores de escena**: un nivel de alerta cambia; se siente un terremoto cerca.
- Una **acción de escena** que lee los niveles y el último terremoto en una frase.

## Requisitos

- Gladys Assistant 5.3 o posterior.
- Acceso a Internet desde el equipo de Gladys (la integración lee `api.geonet.org.nz`).
- Para los terremotos y las distancias: la ubicación de su casa en Gladys (Ajustes → Casas), o coordenadas
  introducidas en la configuración.

## Configuración

Instale la integración desde la tienda (o Integraciones → Instalar desde GitHub, con la dirección
`https://github.com/guim31/gladys-geonet`) y abra su pestaña Configuración.

### Ajustes

| Ajuste                     | Por defecto | Efecto                                                                            |
| -------------------------- | ----------- | --------------------------------------------------------------------------------- |
| Volcanes seguidos          | ninguno     | Los volcanes que seguir, un dispositivo cada uno                                  |
| Dispositivo Nueva Zelanda  | activado    | El nivel más alto del país, como dispositivo y en el widget                       |
| Radio                      | 100 km      | Desactivado, 25, 50, 100, 200 o 300 km entre su casa y el epicentro               |
| Intensidad mínima          | 3 – débil   | Se ignoran los terremotos más débiles (3 débil, 4 ligero, 5 moderado, 6 fuerte)   |
| Latitud del centro         | vacío       | Deje ambas coordenadas vacías para usar la ubicación de su casa                   |
| Longitud del centro        | vacío       | Grados decimales, este positivo (`174.7762`)                                      |
| Intervalo de actualización | 2 minutos   | 1, 2, 5, 10 o 15 minutos                                                          |
| Idioma de los textos       | Francés     | Nombres de los dispositivos y funciones (al crearlos) y textos enviados a escenas |

Guarde, abra la pestaña Descubrimiento y añada a Gladys los dispositivos que desee. **Mostrar los niveles
actuales** comprueba lo que captan sus ajustes.

### Volcanes y niveles de alerta

Los doce volcanes clasificados por GeoNet: Kermadec Islands (Rangitāhua), Northland, Auckland Volcanic
Field, Mayor Island (Tūhua), Whakaari/White Island, Okataina (Tarawera), Rotorua, Taupō, Tongariro,
Ngāuruhoe, Ruapehu y Taranaki Maunga. Los niveles 0 a 2 describen una agitación sin erupción (0 ninguna,
1 menor, 2 moderada a elevada); 3 a 5 una erupción (3 menor, 4 moderada, 5 mayor). Lea
[los niveles explicados por GeoNet](https://www.geonet.org.nz/about/volcano/val) (en inglés).

## Dispositivos

| Dispositivo               | Función                     | Valores                                                    |
| ------------------------- | --------------------------- | ---------------------------------------------------------- |
| Volcán …                  | Nivel de alerta volcánica   | 0 a 5                                                      |
|                           | Código de color de aviación | Insignia de riesgo: 0 verde, 1 amarillo, 2 naranja, 3 rojo |
|                           | Actividad volcánica         | La frase de GeoNet, en inglés                              |
|                           | Distancia                   | km desde el centro                                         |
| Volcanes de Nueva Zelanda | Nivel de alerta más alto    | 0 a 5                                                      |
|                           | Volcanes en nivel 1 o más   | Número                                                     |
|                           | Volcán más activo           | Nombre, nivel y color                                      |
| Terremotos sentidos       | Magnitud                    | Del último terremoto en el radio                           |
|                           | Intensidad (MMI)            | Su intensidad, calculada por GeoNet                        |
|                           | Terremotos sentidos (24 h)  | Terremotos en el radio en las últimas 24 horas             |
|                           | Distancia del epicentro     | km desde el centro                                         |
|                           | Último terremoto sentido    | Magnitud, intensidad, lugar y hora, en texto               |

Los niveles conservan su historial. La insignia de Gladys se detiene en «alto» (3): el nivel de alerta es
un número simple para que los niveles 4 y 5 sigan siendo exactos.

## Widget de panel

Añada el widget **GeoNet** a un panel. Muestra el número de volcanes en nivel 1 o más, el último terremoto
sentido, luego sus volcanes seguidos y, con el dispositivo Nueva Zelanda, todo volcán por encima del
nivel 0, los más activos primero. Al tocar una fila se abre su detalle (frases de GeoNet, profundidad del
terremoto) y un enlace a su página de GeoNet. Ajustes: solo los volcanes por encima del nivel 0, mostrar
el último terremoto, mostrar el enlace a GeoNet.

## Disparadores de escena

- **Volcán GeoNet: nivel de alerta cambiado**: el nivel o el código de color de un volcán de Nueva Zelanda
  cambia. Filtros: el volcán, el nuevo nivel, en aumento o en descenso. Variables: `volcano`,
  `alert_level`, `previous_alert_level`, `direction`, `aviation_color`, `aviation_color_name`, `activity`,
  `hazards`, `distance_km`, `summary`, `url`.
- **GeoNet: terremoto sentido cerca**: un nuevo terremoto de al menos la intensidad mínima, en el radio, de
  menos de seis horas. Filtro: la intensidad. Variables: `magnitude`, `mmi`, `mmi_name`, `distance_km`,
  `depth_km`, `locality`, `time`, `summary`, `url`.

La integración recuerda lo que ha visto en `/data`: un reinicio no vuelve a disparar nada, y un nuevo
radio, una nueva intensidad o un nuevo centro no dispara nada para los terremotos ya listados.

## Acción de escena

**GeoNet: leer los niveles** devuelve `text` (los volcanes mostrados y el último terremoto sentido, en una
frase, en el idioma de la configuración), `max_level` (el nivel más alto entre ellos, de 0 a 5) y
`elevated_count` (los que están en nivel 1 o más). Cuando GeoNet no responde, la acción falla y la escena
lo indica.

## Ejemplos de escenas

- Recibir un mensaje cuando el Ruapehu pase al nivel 2 o más: disparador «Volcán GeoNet: nivel de alerta
  cambiado», filtros «Ruapehu», «Nivel 2» a «Nivel 5» y «En aumento», luego enviar el `summary` y la
  `url`.
- Encender las luces de noche cuando se sienta un terremoto fuerte: disparador «GeoNet: terremoto sentido
  cerca», filtro «6 – fuerte» y superiores.
- Cada mañana, leer los niveles en voz alta: disparador programado, acción «GeoNet: leer los niveles»,
  luego decir `text`.

## Fuentes de datos, condiciones y cuotas

Los datos proceden de GeoNet (GNS Science), mediante su API pública (`https://api.geonet.org.nz`):
`/volcano/val` para los niveles de alerta y `/quake?MMI=<n>` para los 100 últimos terremotos de intensidad
n o más, en cada actualización. Se publican bajo la
[licencia Creative Commons Reconocimiento 3.0 Nueva Zelanda (CC BY 3.0 NZ)](https://creativecommons.org/licenses/by/3.0/nz/);
la integración cita a GeoNet en el widget. GeoNet no publica ninguna cuota: la integración pide dos
documentos pequeños por actualización, cada 2 minutos por defecto. Se ignoran los terremotos eliminados por
los analistas.

## Solución de problemas

- **«Sin centro para los terremotos y las distancias»**: indique la ubicación de su casa en Gladys, o
  introduzca coordenadas.
- **«GeoNet no responde»**: los valores se quedan como estaban; la integración lo vuelve a intentar en la
  siguiente actualización. Compruebe el acceso a Internet del equipo de Gladys.
- **Ningún terremoto**: una zona más tranquila, un radio menor o una intensidad mayor; compruébelo en
  [geonet.org.nz](https://www.geonet.org.nz/earthquake).
- **Ningún dispositivo nuevo tras cambiar la lista**: abra la pestaña Descubrimiento y añádalo.
- Ejecute el contenedor con `LOG_LEVEL=debug` para ver cada actualización en sus registros.

## Límites

- Solo Nueva Zelanda. La intensidad es la que GeoNet calcula para el terremoto (su sacudida más fuerte
  esperada), no una medida en su casa.
- Un terremoto aparece en GeoNet unos minutos después, y sus valores pueden revisarse; el disparador se
  activa una vez, con los primeros valores.
- Las frases de actividad y de peligros y los lugares están en inglés, como los escribe GeoNet.
- La fecha del último cambio de nivel solo se conoce por la observación de la propia integración.
- El nombre de un dispositivo y de sus funciones se fija al crearlo, en el idioma elegido entonces.
