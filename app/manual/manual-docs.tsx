'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  FileClock,
  Flame,
  Gauge,
  History,
  Info,
  Keyboard,
  Layers3,
  Map,
  MapPin,
  Menu,
  Radio,
  Route,
  Ruler,
  Satellite,
  Search,
  ShieldCheck,
  TableProperties,
  Truck,
  Upload,
  Wind,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import styles from './manual.module.css';

type NavItem = {
  title: string;
  href: `#${string}`;
  icon: LucideIcon;
  description: string;
  keywords: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navigation: NavGroup[] = [
  {
    label: 'Primeros pasos',
    items: [
      {
        title: 'Descripción general',
        href: '#descripcion-general',
        icon: BookOpen,
        description: 'Propósito, alcance y componentes del producto.',
        keywords: 'inicio introducción alcance sistema',
      },
      {
        title: 'Inicio de guardia',
        href: '#inicio-guardia',
        icon: CheckCircle2,
        description: 'Controles iniciales antes de tomar decisiones. Principalmente revisar el estado de las fuentes, incidentes y recursos.',
        keywords: 'guardia inicio conexión fuentes incidentes unidades mantenimiento',
      },
      {
        title: 'Flujo operativo',
        href: '#flujo-operativo',
        icon: Route,
        description: 'Recorrido desde la detección hasta el cierre.',
        keywords: 'detectar evaluar priorizar coordinar cerrar',
      },
      {
        title: 'Superficies del producto',
        href: '#superficies',
        icon: Layers3,
        description: 'Mapa, comando, recursos, análisis e historial.',
        keywords: 'secciones pantallas tablero mapa',
      },
    ],
  },
  {
    label: 'Operación',
    items: [
      {
        title: 'Mapa operativo',
        href: '#mapa-operativo',
        icon: Map,
        description: 'Capas, herramientas y lectura territorial.',
        keywords: 'viento rayos sismos térmica recursos medición',
      },
      {
        title: 'Gestión de incidentes',
        href: '#gestion-incidentes',
        icon: Flame,
        description: 'Estados, evidencia, acciones y seguimiento.',
        keywords: 'foco confirmar probable extinguir falso positivo notas',
      },
      {
        title: 'Recursos y despacho',
        href: '#recursos-despacho',
        icon: Truck,
        description: 'Cuarteles, unidades, activos y asignaciones.',
        keywords: 'móviles brigadas cisternas mantenimiento CSV',
      },
      {
        title: 'Historial y análisis',
        href: '#historial-analisis',
        icon: BarChart3,
        description: 'Períodos, indicadores, zonas y tendencias.',
        keywords: '90 días gráficos riesgo FRP estadísticas',
      },
    ],
  },
  {
    label: 'Información',
    items: [
      {
        title: 'Fuentes de datos',
        href: '#fuentes-datos',
        icon: Satellite,
        description: 'Origen y función de cada señal integrada.',
        keywords: 'GOES NASA FIRMS Sentinel Open Meteo USGS HLS NOAA',
      },
      {
        title: 'Criterios de lectura',
        href: '#criterios-lectura',
        icon: Gauge,
        description: 'Correlación, prioridad y contexto operativo.',
        keywords: 'confianza repetición proximidad FRP decisión',
      },
    ],
  },
  {
    label: 'Control y consulta',
    items: [
      {
        title: 'Control y trazabilidad',
        href: '#validacion-trazabilidad',
        icon: ShieldCheck,
        description: 'Revisiones, límites y registro de decisiones.',
        keywords: 'auditoría operador confirmación cierre historial',
      },
      {
        title: 'Continuidad operativa',
        href: '#continuidad-operativa',
        icon: Bell,
        description: 'Criterios para trabajar con datos incompletos o demorados.',
        keywords: 'sin conexión fuente demorada ubicación recursos datos incompletos',
      },
      {
        title: 'Preguntas frecuentes',
        href: '#preguntas-frecuentes',
        icon: CircleHelp,
        description: 'Respuestas sobre señales, estados y operación.',
        keywords: 'FAQ dudas confirmación escaneo datos',
      },
    ],
  },
];

const allItems = navigation.flatMap((group) => group.items);

const onThisPage = [
  { title: 'Qué integra', href: '#que-integra' },
  { title: 'Inicio de guardia', href: '#inicio-guardia' },
  { title: 'Flujo operativo', href: '#flujo-operativo' },
  { title: 'Mapa operativo', href: '#mapa-operativo' },
  { title: 'Gestión de incidentes', href: '#gestion-incidentes' },
  { title: 'Recursos y despacho', href: '#recursos-despacho' },
  { title: 'Historial y análisis', href: '#historial-analisis' },
  { title: 'Fuentes de datos', href: '#fuentes-datos' },
  { title: 'Criterios de lectura', href: '#criterios-lectura' },
  { title: 'Control y trazabilidad', href: '#validacion-trazabilidad' },
  { title: 'Continuidad operativa', href: '#continuidad-operativa' },
  { title: 'Preguntas frecuentes', href: '#preguntas-frecuentes' },
];

const surfaces = [
  {
    title: 'Mapa en vivo',
    icon: Map,
    description: 'Lectura territorial de focos, ambiente y recursos; filtros, mediciones y reporte manual desde una coordenada.',
    href: '/',
  },
  {
    title: 'Centro operativo',
    icon: Radio,
    description: 'Cola priorizada, estado de las fuentes, capacidad disponible y seguimiento de cada respuesta.',
    href: '/dashboard',
  },
  {
    title: 'Parque operativo',
    icon: Truck,
    description: 'Alta y actualización de cuarteles, móviles, maquinaria, fuentes de agua y otros apoyos territoriales.',
    href: '/dashboard/recursos',
  },
  {
    title: 'Mantenimiento',
    icon: Wrench,
    description: 'Trabajos programados, vencimientos, responsables y estado de cada unidad fuera o dentro de servicio.',
    href: '/dashboard/mantenimiento',
  },
  {
    title: 'Análisis',
    icon: BarChart3,
    description: 'Riesgo, evolución, zonas, salud de las fuentes, condiciones ambientales y capacidad de respuesta.',
    href: '/dashboard/analisis',
  },
  {
    title: 'Historial',
    icon: History,
    description: 'Incidentes activos, cerrados y archivados, junto con el registro de acciones y cambios operativos.',
    href: '/dashboard/historial',
  },
];

const mapCapabilities = [
  {
    title: 'Detección y calor',
    icon: Flame,
    items: ['Focos operativos', 'Anomalías térmicas', 'Intensidad y estado', 'Modo histórico'],
  },
  {
    title: 'Entorno',
    icon: Wind,
    items: ['Viento a 10 metros', 'Rayos GOES-19 GLM', 'Sismos USGS', 'Relieve y mapa satelital'],
  },
  {
    title: 'Respuesta',
    icon: Truck,
    items: ['Cuarteles', 'Móviles por estado', 'Maquinaria', 'Agua y activos'],
  },
  {
    title: 'Referencia territorial',
    icon: MapPin,
    items: ['Centros de salud', 'Comisarías', 'Escuelas', 'Hidrantes estimados'],
  },
];

const incidentStates = [
  {
    state: 'Sin confirmar',
    meaning: 'Detección inicial pendiente de revisión o de nueva evidencia.',
    next: 'Revisar fuentes y contexto.',
  },
  {
    state: 'Probable',
    meaning: 'La señal acumula evidencia suficiente para elevar su atención.',
    next: 'Priorizar evaluación operativa.',
  },
  {
    state: 'Confirmado',
    meaning: 'El foco fue validado por evidencia térmica calificada o por un operador.',
    next: 'Coordinar respuesta y seguimiento.',
  },
  {
    state: 'Falso positivo',
    meaning: 'La revisión determinó que la señal no corresponde a un incendio operativo.',
    next: 'Conservar el registro cerrado.',
  },
  {
    state: 'Extinguido',
    meaning: 'El incidente finalizó su etapa activa y queda disponible en el historial.',
    next: 'Cerrar o archivar con trazabilidad.',
  },
];

const sources = [
  {
    source: 'GOES-19 ABI FDCF',
    provider: 'NOAA / Earth Engine / AWS Open Data',
    role: 'Alerta temprana',
    contribution: 'Puntos calientes geoestacionarios con alta frecuencia temporal.',
  },
  {
    source: 'NASA FIRMS',
    provider: 'NASA',
    role: 'Evidencia térmica',
    contribution: 'VIIRS NOAA-21, NOAA-20, SNPP, MODIS y GOES NRT con confianza, brillo y FRP.',
  },
  {
    source: 'Sentinel-3 SLSTR',
    provider: 'Copernicus / EUMETSAT',
    role: 'Contraste térmico',
    contribution: 'Detecciones de fuego y potencia radiativa sobre el área configurada.',
  },
  {
    source: 'NASA HLS',
    provider: 'NASA / LP DAAC',
    role: 'Contexto visual',
    contribution: 'Escenas Sentinel-2 y Landsat para vegetación, superficie y huella territorial.',
  },
  {
    source: 'Open-Meteo',
    provider: 'Open-Meteo / Copernicus DEM',
    role: 'Contexto ambiental',
    contribution: 'Viento, temperatura, humedad, lluvia, tormentas y elevación.',
  },
  {
    source: 'GOES-19 GLM',
    provider: 'NOAA AWS Open Data',
    role: 'Riesgo eléctrico',
    contribution: 'Actividad de rayos reciente filtrada a la jurisdicción configurada.',
  },
  {
    source: 'USGS Earthquake Catalog',
    provider: 'USGS',
    role: 'Contexto regional',
    contribution: 'Eventos sísmicos recientes dentro del ámbito configurado.',
  },
];

export function ManualDocs() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('#descripcion-general');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const ids = allItems.map((item) => item.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visible) setActiveHash(`#${visible.target.id}`);
      },
      { rootMargin: '-18% 0px -72% 0px' }
    );

    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const followAnchor = (href: string) => {
    setActiveHash(href);
    setMenuOpen(false);
  };

  return (
    <div className={styles.docs}>
      <DocsHeader onSearch={() => setSearchOpen(true)} onMenu={() => setMenuOpen(true)} />

      <div className={styles.docsLayout}>
        <DocsSidebar activeHash={activeHash} open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={followAnchor} />

        <main className={styles.content}>
          <article>
            <div className={styles.breadcrumbs} aria-label="Navegación secundaria">
              <span>Manual operativo</span>
              <ChevronRight size={13} />
              <span>Primeros pasos</span>
            </div>

            <section id="descripcion-general" className={styles.docSection}>
              <div className={styles.pageLabel}>Descripción general</div>
              <h1>OpenFireDetection</h1>
              <p className={styles.lead}>
                Sistema operativo para detectar, evaluar, coordinar y seguir focos de incendio dentro del territorio
                configurado, con
                información satelital, contexto ambiental, recursos territoriales y registro de cada decisión.
              </p>

              <p>
                OpenFireDetection reúne en un mismo espacio la lectura del territorio, la revisión de señales, la
                respuesta de guardia y la consulta histórica. Su objetivo es ordenar la información disponible para
                que una alerta pueda revisarse con rapidez, sin perder el origen de los datos ni confundir una señal
                automática con una confirmación operativa.
              </p>

              <Callout icon={Info} title="Alcance operativo" tone="info">
                La decisión combina evidencia disponible y revisión de guardia. GOES-19 aporta alerta temprana;
                FIRMS y Sentinel-3 agregan evidencia térmica; el clima, los rayos, los sismos y HLS aportan
                contexto. Ninguna lectura aislada reemplaza la verificación del operador.
              </Callout>

              <h2 id="que-integra">Qué integra</h2>
              <div className={styles.overviewGrid}>
                <OverviewCard icon={Satellite} title="Vigilancia" text="Detecciones de GOES-19, NASA FIRMS y Sentinel-3 ubicadas dentro del territorio configurado." />
                <OverviewCard icon={Map} title="Territorio" text="Mapa interactivo con ambiente, recursos, referencias, mediciones y selección precisa de ubicaciones." />
                <OverviewCard icon={Radio} title="Operación" text="Priorización, revisión, despacho, seguimiento, cierre y restauración de incidentes." />
                <OverviewCard icon={FileClock} title="Trazabilidad" text="Historial de decisiones, notas, asignaciones, cambios de recursos y exportaciones operativas." />
              </div>

              <h2>Principios de funcionamiento</h2>
              <ul className={styles.checkList}>
                <CheckItem>El territorio de operación queda restringido al límite configurado.</CheckItem>
                <CheckItem>Cada fuente conserva su origen, momento, producto y nivel de confianza.</CheckItem>
                <CheckItem>Alerta temprana, evidencia térmica y contexto ambiental cumplen funciones diferentes.</CheckItem>
                <CheckItem>Las decisiones manuales quedan asociadas a un operador y a una fecha.</CheckItem>
                <CheckItem>Los incidentes cerrados permanecen disponibles para análisis e historial.</CheckItem>
                <CheckItem>La falta de una lectura reciente se muestra como dato atrasado o ausente, no como ausencia de riesgo.</CheckItem>
                <CheckItem>La disponibilidad de unidades depende del catálogo cargado y de su estado actualizado.</CheckItem>
              </ul>
            </section>

            <section id="inicio-guardia" className={styles.docSection}>
              <SectionTitle
                eyebrow="Primeros pasos"
                title="Inicio de guardia"
                description="Una revisión breve al comenzar el turno evita trabajar con información desactualizada, recursos incompletos o incidentes sin seguimiento."
              />

              <p>
                Comenzá por el Centro operativo. La cabecera muestra la última actualización disponible y el estado
                general de las fuentes. Después, revisá la cola de incidentes y confirmá que las unidades, cuarteles y
                activos necesarios estén cargados con una situación operativa vigente.
              </p>

              <h2>Control inicial</h2>
              <ul className={styles.checkList}>
                <CheckItem>Verificá que el sistema indique conexión y una actualización reciente.</CheckItem>
                <CheckItem>Revisá si existen fuentes atrasadas o sin datos antes de interpretar el panorama.</CheckItem>
                <CheckItem>Identificá incidentes activos, probables o confirmados que requieran continuidad.</CheckItem>
                <CheckItem>Leé las notas y el historial de cada incidente recibido del turno anterior.</CheckItem>
                <CheckItem>Confirmá qué unidades están disponibles, asignadas, fuera de servicio o en mantenimiento.</CheckItem>
                <CheckItem>Revisá vencimientos de mantenimiento y recursos estratégicos sin ubicación cargada.</CheckItem>
                <CheckItem>Comprobá que el operador visible corresponda a la guardia que realizará las acciones.</CheckItem>
              </ul>

              <h2>Orden recomendado de lectura</h2>
              <div className={styles.steps}>
                <Step number="1" title="Estado general">
                  Mirá la hora de actualización, la salud de las fuentes y cualquier aviso de datos demorados.
                </Step>
                <Step number="2" title="Incidentes pendientes">
                  Priorizá confirmados y probables; después revisá señales nuevas sin confirmar y seguimientos abiertos.
                </Step>
                <Step number="3" title="Capacidad de respuesta">
                  Contrastá unidades disponibles, mantenimiento abierto, bases cercanas y fuentes de agua cargadas.
                </Step>
                <Step number="4" title="Contexto territorial">
                  Abrí el mapa para revisar viento, accesos, referencias próximas y posibles limitaciones del terreno.
                </Step>
              </div>

              <Callout icon={AlertTriangle} title="Una pantalla sin alertas no garantiza ausencia de incendios" tone="warning">
                Antes de concluir que no hay actividad, comprobá la hora del último escaneo y el estado de cada
                fuente. Si una señal está atrasada o ausente, mantené la verificación por los canales operativos
                disponibles.
              </Callout>
            </section>

            <section id="flujo-operativo" className={styles.docSection}>
              <SectionTitle eyebrow="Primeros pasos" title="Flujo operativo" description="Secuencia completa desde la recepción de una señal hasta el cierre, el archivo y la consulta posterior del registro." />
              <p>
                El flujo mantiene separadas tres preguntas: qué señal llegó, qué significa para la guardia y qué
                respuesta se decidió. Esa separación permite revisar una detección sin elevarla automáticamente y
                conserva el contexto usado en cada paso.
              </p>
              <div className={styles.steps}>
                <Step number="1" title="Detectar">
                  El escaneo consulta las fuentes térmicas configuradas. Un reporte manual también puede iniciar un
                  incidente desde una coordenada del mapa, una ubicación actual o una referencia recibida por la
                  guardia. Todo reporte manual comienza sin confirmar.
                </Step>
                <Step number="2" title="Correlacionar">
                  Las señales cercanas en tiempo y espacio se asocian al mismo foco. Repetición, confianza y FRP
                  fortalecen la evidencia acumulada. La ficha muestra cuántas detecciones sostienen la lectura y cuál
                  fue la fuente principal.
                </Step>
                <Step number="3" title="Contextualizar">
                  Clima, terreno, proyección, acceso, fuentes cercanas y disponibilidad de recursos completan la ficha
                  táctica. Estos datos ayudan a decidir prioridad y respuesta, pero no confirman por sí mismos un
                  incendio.
                </Step>
                <Step number="4" title="Coordinar">
                  La guardia revisa, confirma o descarta, agrega notas, asigna unidades y actualiza el avance desde la
                  salida hasta la liberación del recurso.
                </Step>
                <Step number="5" title="Cerrar y conservar">
                  La extinción finaliza la etapa activa. El cierre y el archivo mantienen notas, asignaciones,
                  evidencia y decisiones asociadas para consultas posteriores.
                </Step>
              </div>
              <Callout icon={Clock3} title="Frecuencia durante la operación" tone="neutral">
                Durante una sesión operativa activa, el dashboard programa un escaneo cada 10 minutos. El botón
                <strong> Escanear</strong> inicia la misma secuencia bajo demanda.
              </Callout>

              <h2>Antes de finalizar una intervención</h2>
              <ul className={styles.checkList}>
                <CheckItem>Registrá la última novedad y el resultado de la verificación.</CheckItem>
                <CheckItem>Actualizá el avance de cada unidad y liberá los recursos que ya no estén asignados.</CheckItem>
                <CheckItem>Marcá la extinción únicamente cuando la etapa activa haya finalizado.</CheckItem>
                <CheckItem>Usá el archivo para retirar el incidente de la operación diaria sin borrar su historia.</CheckItem>
              </ul>
            </section>

            <section id="superficies" className={styles.docSection}>
              <SectionTitle eyebrow="Primeros pasos" title="Espacios de trabajo" description="Cada espacio responde a una tarea operativa concreta y comparte la misma información de incidentes, recursos y seguimiento." />
              <p>
                Podés pasar del mapa al centro operativo, abrir un incidente y continuar su gestión sin perder el
                estado registrado. Recursos, mantenimiento, análisis e historial amplían la misma operación desde
                perspectivas diferentes.
              </p>
              <div className={styles.surfaceGrid}>
                {surfaces.map((surface) => (
                  <Link key={surface.title} href={surface.href} className={styles.surfaceCard}>
                    <surface.icon size={19} />
                    <div>
                      <h3>{surface.title}</h3>
                      <p>{surface.description}</p>
                    </div>
                    <ExternalLink size={14} />
                  </Link>
                ))}
              </div>
            </section>

            <section id="mapa-operativo" className={styles.docSection}>
              <SectionTitle eyebrow="Operación" title="Mapa operativo" description="La vista territorial combina detecciones, ambiente, recursos y referencias sin mezclar el propósito de cada capa." />

              <p>
                El mapa es el punto de partida para ubicar un foco y comprender qué existe alrededor. Seleccioná un
                marcador para abrir su ficha; activá solamente las capas necesarias para la decisión actual y compará
                la antigüedad de cada lectura antes de usarla como contexto.
              </p>

              <h2>Grupos de capas</h2>
              <div className={styles.capabilityGrid}>
                {mapCapabilities.map((capability) => (
                  <div key={capability.title} className={styles.capabilityCard}>
                    <div className={styles.capabilityTitle}>
                      <capability.icon size={18} />
                      <h3>{capability.title}</h3>
                    </div>
                    <ul>
                      {capability.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              <h2>Cómo leer una señal en el territorio</h2>
              <ol className={styles.numberList}>
                <li>Ubicá el foco dentro del límite configurado y comprobá si ya existe un incidente próximo.</li>
                <li>Revisá estado, antigüedad, cantidad de detecciones, fuente principal y FRP disponible.</li>
                <li>Activá viento y contexto térmico para entender condiciones de propagación, no para confirmar.</li>
                <li>Mostrá cuarteles, móviles y activos para evaluar distancias y capacidad registrada.</li>
                <li>Usá referencias territoriales y herramientas de medición para completar la lectura de acceso.</li>
              </ol>

              <h2>Herramientas</h2>
              <div className={styles.iconList}>
                <IconListItem icon={Ruler} title="Medir distancia" text="Calcula la separación entre puntos seleccionados para estimar alcance y proximidad territorial." />
                <IconListItem icon={TableProperties} title="Medir superficie" text="Calcula el área de un polígono dibujado y permite limpiar la medición al terminar." />
                <IconListItem icon={MapPin} title="Reportar foco" text="Toma una coordenada del mapa, permite agregar notas y crea un registro manual sin confirmar." />
                <IconListItem icon={Search} title="Buscar y filtrar" text="Reduce la vista por identificador, coordenadas, unidad, estado, fecha, FRP o cantidad de detecciones." />
                <IconListItem icon={Download} title="Exportar CSV" text="Descarga los incidentes considerados por la vista para continuar su revisión fuera del sistema." />
                <IconListItem icon={Keyboard} title="Atajos" text="Abre el reporte, muestra la ayuda o cierra paneles sin abandonar la lectura territorial." />
              </div>

              <h2>Reporte manual</h2>
              <p>
                Usá <strong>Reportar foco</strong> cuando la guardia reciba una observación visual, una llamada o una
                referencia externa que todavía no figure en el mapa. Elegí la ubicación, comprobá que las coordenadas
                estén dentro del territorio configurado y agregá una nota con el origen del aviso, referencias de acceso y cualquier
                dato que ayude a la revisión. El registro queda pendiente de confirmación.
              </p>

            </section>

            <section id="gestion-incidentes" className={styles.docSection}>
              <SectionTitle eyebrow="Operación" title="Gestión de incidentes" description="Una única ficha reúne evidencia, contexto, acciones, recursos y cronología." />

              <p>
                Seleccioná un incidente desde el mapa o la cola operativa. La ficha muestra ubicación, estado de
                evidencia, situación operativa, prioridad, fuente principal, cantidad de detecciones, FRP máximo,
                unidad asignada y siguiente acción. Leé primero el resumen y después profundizá en despacho, riesgo e
                historial.
              </p>

              <h2>Revisión paso a paso</h2>
              <ol className={styles.numberList}>
                <li>Confirmá que la ubicación y la hora sean coherentes con el aviso recibido.</li>
                <li>Revisá fuente principal, repeticiones, confianza disponible y potencia radiativa.</li>
                <li>Contrastá clima, terreno, proyección y recursos cercanos con ubicación real.</li>
                <li>Elegí confirmar, marcar falso positivo o mantener seguimiento según la evidencia.</li>
                <li>Agregá una nota clara cuando exista una comunicación, verificación o cambio relevante.</li>
                <li>Asigná recursos y actualizá cada avance hasta su liberación.</li>
              </ol>

              <h2>Estados de evidencia</h2>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Significado</th>
                      <th>Tratamiento operativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidentStates.map((item) => (
                      <tr key={item.state}>
                        <td><StatusBadge status={item.state} /></td>
                        <td>{item.meaning}</td>
                        <td>{item.next}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2>Contenido de la ficha</h2>
              <div className={styles.tabDocs}>
                <div><strong>Resumen</strong><span>Fuente, hora, coordenadas, detecciones, FRP, estado, prioridad, unidad y siguiente acción.</span></div>
                <div><strong>Despacho</strong><span>Unidad o recurso, rol, avance, responsable de la asignación, fecha y notas operativas.</span></div>
                <div><strong>Riesgo</strong><span>Clima, terreno, proyección, accesos, recursos próximos y datos faltantes que afectan la lectura.</span></div>
                <div><strong>Historial</strong><span>Confirmaciones, descartes, notas, asignaciones, seguimiento, extinción, cierre y restauración.</span></div>
              </div>

              <h2>Acciones registradas</h2>
              <ul className={styles.bulletList}>
                <li>Confirmar un foco o marcarlo como falso positivo.</li>
                <li>Actualizar prioridad y estado operativo.</li>
                <li>Asignar, avanzar o liberar una unidad.</li>
                <li>Agregar notas del operativo.</li>
                <li>Marcar como extinguido, cerrar o archivar.</li>
              </ul>

              <h2>Notas que sirven durante el operativo</h2>
              <p>
                Registrá hechos observables: quién informó, desde dónde, qué se verificó, qué acceso se recomienda,
                qué unidad interviene y cuál es la próxima revisión acordada. Evitá repetir datos que ya aparecen en
                la ficha y no uses una nota como sustituto de un cambio de estado o de despacho.
              </p>
              <Callout icon={FileClock} title="El archivo no borra el incidente" tone="info">
                Archivar retira el registro de la operación diaria, pero conserva sus señales, notas, asignaciones y
                cambios. Si vuelve a requerir atención, puede restaurarse a la actividad.
              </Callout>
            </section>

            <section id="recursos-despacho" className={styles.docSection}>
              <SectionTitle eyebrow="Operación" title="Recursos y despacho" description="El catálogo operativo vincula disponibilidad, ubicación, capacidad, asignaciones y mantenimiento." />

              <p>
                El sistema solo puede calcular proximidad y mostrar disponibilidad a partir de datos cargados. Una
                unidad sin ubicación, un cuartel sin coordenadas o un móvil con estado desactualizado puede distorsionar
                la lectura de respuesta. Actualizá el catálogo cuando cambie la base, la capacidad o la situación del
                recurso.
              </p>

              <div className={styles.definitionGrid}>
                <Definition icon={MapPin} term="Cuartel" description="Código, localidad, domicilio, contacto, coordenadas y unidades relacionadas." />
                <Definition icon={Truck} term="Unidad" description="Tipo, base, estado, patente, litros, dotación, ubicación y observaciones." />
                <Definition icon={Boxes} term="Activo" description="Fuente de agua, helipuerto, espera, acceso u otro apoyo territorial." />
                <Definition icon={Wrench} term="Mantenimiento" description="Trabajo, vencimiento, kilometraje, responsable, estado y notas." />
              </div>

              <h2>Ciclo de despacho</h2>
              <div className={styles.dispatchFlow}>
                {['Asignado', 'En camino', 'En el lugar', 'Liberado'].map((state, index) => (
                  <div key={state} className={styles.dispatchState}>
                    <span>{index + 1}</span>
                    <strong>{state}</strong>
                    {index < 3 ? <ArrowRight size={15} /> : null}
                  </div>
                ))}
              </div>
              <p>
                <strong>Asignado</strong> reserva el recurso para el incidente; <strong>En camino</strong> registra la
                salida; <strong>En el lugar</strong> confirma llegada; <strong>Liberado</strong> finaliza la asignación y
                permite volver a considerar la unidad según su estado operativo.
              </p>

              <h2>Actualización del parque operativo</h2>
              <ul className={styles.checkList}>
                <CheckItem>Cargá códigos y nombres que permitan reconocer cada unidad durante una comunicación.</CheckItem>
                <CheckItem>Completá base, contacto y coordenadas reales para obtener distancias útiles.</CheckItem>
                <CheckItem>Registrá capacidad de agua, dotación, patente y observaciones cuando correspondan.</CheckItem>
                <CheckItem>Marcá fuera de servicio los recursos que no puedan ser despachados.</CheckItem>
                <CheckItem>Asociá mantenimientos con vencimiento, responsable y notas suficientes para el relevo.</CheckItem>
                <CheckItem>Usá activos territoriales solo cuando su ubicación y condición estén verificadas.</CheckItem>
              </ul>

              <h2>Importación de recursos</h2>
              <p>
                El parque operativo acepta archivos CSV exportados desde una planilla. La validación previa informa
                filas válidas y errores antes de registrar cambios; la importación conserva auditoría por entidad.
              </p>
              <div className={styles.actionPair}>
                <span><Upload size={16} /> Validar CSV</span>
                <ArrowRight size={15} />
                <span><CheckCircle2 size={16} /> Importar registros válidos</span>
              </div>

              <Callout icon={Truck} title="La cercanía no equivale a disponibilidad" tone="neutral">
                Una distancia corta ayuda a comparar alternativas, pero la decisión también debe considerar estado,
                capacidad, mantenimiento, acceso y asignaciones activas.
              </Callout>
            </section>

            <section id="historial-analisis" className={styles.docSection}>
              <SectionTitle eyebrow="Operación" title="Historial y análisis" description="La actividad reciente y el registro histórico comparten filtros, fuentes y referencias operativas." />

              <p>
                Usá el historial para reconstruir qué ocurrió y el análisis para comparar períodos, zonas y condiciones.
                Los dos espacios se complementan: el historial conserva el detalle de cada registro; el análisis resume
                patrones y capacidad operativa sin reemplazar la lectura individual.
              </p>

              <h2>Períodos disponibles</h2>
              <div className={styles.periods}>
                {['24 horas', '7 días', '30 días', '90 días', 'Todo'].map((period) => <span key={period}>{period}</span>)}
              </div>

              <h2>Lecturas principales</h2>
              <div className={styles.iconList}>
                <IconListItem icon={Gauge} title="Riesgo territorial" text="Puntaje, nivel, confianza de datos y factor dominante." />
                <IconListItem icon={Activity} title="Evolución" text="Detecciones, confirmaciones, falsos positivos, riesgo medio y FRP máximo." />
                <IconListItem icon={MapPin} title="Zonas" text="Actividad, fuente dominante y cobertura meteorológica por sector." />
                <IconListItem icon={Satellite} title="Matriz de fuentes" text="Última señal, estado de actualización y participación en detecciones." />
                <IconListItem icon={Wind} title="Ambiente" text="Cobertura, viento máximo y combinación de calor, sequedad y viento." />
                <IconListItem icon={Truck} title="Respuesta" text="Unidades, mantenimiento y activos estratégicos disponibles." />
              </div>

              <h2>Consultas habituales</h2>
              <ul className={styles.bulletList}>
                <li>Revisar incidentes activos, cerrados o archivados y abrir nuevamente su ficha.</li>
                <li>Buscar cambios por tipo, entidad, acción, operador o detalle registrado.</li>
                <li>Comparar detecciones, confirmaciones, falsos positivos, riesgo medio y FRP máximo por período.</li>
                <li>Identificar sectores con mayor actividad y la fuente predominante en cada zona.</li>
                <li>Detectar fuentes demoradas, cobertura meteorológica incompleta o capacidad de respuesta reducida.</li>
                <li>Exportar incidentes, recursos y mantenimiento para un parte o una revisión externa.</li>
              </ul>

              <Callout icon={History} title="Conservación histórica" tone="info">
                El modo histórico recupera todas las páginas del período de 90 días y evita que el límite inicial de
                resultados oculte registros cerrados o archivados. La línea temporal del mapa permite avanzar por el
                período y observar qué focos ya existían en cada momento.
              </Callout>
            </section>

            <section id="fuentes-datos" className={styles.docSection}>
              <SectionTitle eyebrow="Información" title="Fuentes de datos" description="Cada proveedor aporta un tipo de evidencia específico. La interfaz conserva esa distinción en el mapa y en la ficha del incidente." />
              <p>
                Antes de usar una señal, mirá qué proveedor la produjo, cuándo fue observada y qué función cumple. Una
                fuente puede alertar, aportar evidencia térmica o describir el entorno. La combinación mejora la
                lectura, pero no convierte automáticamente una señal en una confirmación.
              </p>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Fuente</th>
                      <th>Proveedor</th>
                      <th>Rol</th>
                      <th>Aporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr key={source.source}>
                        <td><strong>{source.source}</strong></td>
                        <td>{source.provider}</td>
                        <td><SourceRole role={source.role} /></td>
                        <td>{source.contribution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2>Estado de actualización</h2>
              <ul className={styles.bulletList}>
                <li><strong>Actualizada:</strong> existe una lectura reciente dentro de la ventana esperada.</li>
                <li><strong>Atrasada:</strong> hay datos, pero su antigüedad exige cautela antes de usarlos.</li>
                <li><strong>Ausente:</strong> no existe una lectura utilizable para la consulta actual.</li>
                <li><strong>Deshabilitada:</strong> la fuente no participa de la operación en ese momento.</li>
              </ul>
              <Callout icon={AlertTriangle} title="Lectura de las señales" tone="warning">
                Una detección GOES aislada inicia una alerta temprana, no una confirmación. La promoción del foco
                considera repetición, proximidad, confianza, FRP y revisión operativa.
              </Callout>
            </section>

            <section id="criterios-lectura" className={styles.docSection}>
              <SectionTitle eyebrow="Información" title="Criterios de lectura" description="El motor combina evidencia sin perder la procedencia ni convertir señales ambientales en incendios." />

              <p>
                La prioridad surge de la evidencia acumulada, la antigüedad, el contexto y el ciclo operativo. Leé el
                resultado como una ayuda para ordenar la atención. La decisión final debe considerar lo que la guardia
                conoce por comunicaciones, verificación territorial y evolución del incidente.
              </p>

              <div className={styles.ruleList}>
                <Rule number="01" title="Ámbito territorial">Las coordenadas pasan primero por el límite configurado.</Rule>
                <Rule number="02" title="Correlación espacial">Una señal próxima a un foco existente refuerza ese registro.</Rule>
                <Rule number="03" title="Ventana temporal">La asociación considera la edad de las detecciones y la vigencia de la fuente.</Rule>
                <Rule number="04" title="Calidad de evidencia">Confianza, repetición y potencia radiativa modifican el estado del foco.</Rule>
                <Rule number="05" title="Contexto independiente">Clima, rayos y sismos describen riesgo; no crean ni confirman incendios.</Rule>
                <Rule number="06" title="Decisión trazable">Confirmación, descarte, despacho y cierre conservan actor, fecha y motivo.</Rule>
              </div>

              <h2>Orden para tomar una decisión</h2>
              <ul className={styles.checkList}>
                <CheckItem>Primero, verificá ubicación, hora y vigencia de la señal.</CheckItem>
                <CheckItem>Después, compará repeticiones, fuente, confianza y potencia térmica.</CheckItem>
                <CheckItem>Luego, incorporá viento, terreno, accesos y recursos cercanos.</CheckItem>
                <CheckItem>Finalmente, registrá la decisión y la próxima acción esperada.</CheckItem>
              </ul>
            </section>

            <section id="validacion-trazabilidad" className={styles.docSection}>
              <SectionTitle eyebrow="Control operativo" title="Control y trazabilidad" description="Las decisiones importantes quedan vinculadas a la persona que actuó, el momento y el motivo informado." />
              <p>
                La trazabilidad permite reconstruir una intervención sin depender de la memoria del turno. Antes de
                confirmar, cerrar o archivar, revisá que la ficha tenga contexto suficiente y que el estado elegido
                represente lo ocurrido.
              </p>
              <div className={styles.securityGrid}>
                <SecurityItem icon={MapPin} title="Ubicación territorial">Los reportes manuales deben señalar una coordenada dentro del límite configurado.</SecurityItem>
                <SecurityItem icon={ShieldCheck} title="Decisiones explícitas">Confirmar, descartar, extinguir o archivar requiere una acción deliberada de la guardia.</SecurityItem>
                <SecurityItem icon={FileClock} title="Registro de acciones">Cada cambio conserva operador, fecha, motivo y entidad afectada.</SecurityItem>
                <SecurityItem icon={History} title="Historia preservada">Cerrar o archivar no elimina el incidente ni sus antecedentes.</SecurityItem>
                <SecurityItem icon={Bell} title="Estado de las fuentes">La interfaz distingue señales actuales, demoradas, ausentes o deshabilitadas.</SecurityItem>
                <SecurityItem icon={Truck} title="Recursos verificables">La ubicación y disponibilidad dependen de la información real cargada en el parque operativo.</SecurityItem>
              </div>

              <h2>Datos mínimos para una decisión clara</h2>
              <ul className={styles.checkList}>
                <CheckItem>Ubicación y hora de la observación o detección.</CheckItem>
                <CheckItem>Fuente del aviso y evidencia revisada.</CheckItem>
                <CheckItem>Estado elegido y motivo comprensible para otro turno.</CheckItem>
                <CheckItem>Unidad asignada, avance y novedades relevantes.</CheckItem>
                <CheckItem>Resultado final y condición en la que se liberaron los recursos.</CheckItem>
              </ul>
            </section>

            <section id="continuidad-operativa" className={styles.docSection}>
              <SectionTitle eyebrow="Control operativo" title="Continuidad operativa" description="Criterios para mantener una lectura responsable cuando falta conexión, una fuente está demorada o el catálogo está incompleto." />

              <div className={styles.definitionGrid}>
                <Definition icon={Bell} term="Fuente demorada" description="Revisá la hora de la última lectura y no interpretes la falta de novedades como ausencia de actividad." />
                <Definition icon={Satellite} term="Fuente ausente" description="Continuá con las fuentes disponibles y dejá constancia de la limitación en la evaluación." />
                <Definition icon={MapPin} term="Ubicación dudosa" description="Verificá coordenadas y referencias antes de reportar; no aproximes una ubicación que pueda alterar el despacho." />
                <Definition icon={Truck} term="Catálogo incompleto" description="No infieras disponibilidad ni distancia para recursos sin estado o ubicación real cargada." />
              </div>

              <h2>Qué hacer ante una interrupción</h2>
              <ol className={styles.numberList}>
                <li>Identificá qué información falta y desde qué momento dejó de actualizarse.</li>
                <li>Mantené la verificación por radio, teléfono u otros canales definidos por la operación.</li>
                <li>Conservá hora, origen y detalle de cada novedad para registrarla cuando el sistema esté disponible.</li>
                <li>Al recuperar conexión, revisá primero incidentes activos y evitá duplicar reportes ya existentes.</li>
                <li>Actualizá notas, estados y despachos en el mismo orden en que ocurrieron.</li>
              </ol>

              <h2>Qué evitar</h2>
              <ul className={styles.bulletList}>
                <li>Confirmar un incendio solamente porque una capa ambiental muestra condiciones críticas.</li>
                <li>Suponer que un recurso está libre porque no aparece asignado en una vista desactualizada.</li>
                <li>Crear varios incidentes para señales cercanas sin revisar primero el foco existente.</li>
                <li>Archivar un registro con asignaciones activas o sin una última novedad comprensible.</li>
              </ul>
            </section>

            <section id="preguntas-frecuentes" className={styles.docSection}>
              <SectionTitle eyebrow="Ayuda" title="Preguntas frecuentes" description="Respuestas directas para las situaciones que suelen aparecer durante una guardia." />
              <div className={styles.faqList}>
                <Faq question="¿GOES-19 confirma un incendio?">
                  No por sí solo. GOES-19 funciona como señal temprana. La confirmación considera evidencia adicional
                  o una decisión registrada por el operador.
                </Faq>
                <Faq question="¿Qué diferencia existe entre probable y confirmado?">
                  Probable indica evidencia repetida o suficiente para elevar la atención. Confirmado implica una
                  validación térmica calificada o una confirmación manual.
                </Faq>
                <Faq question="¿El clima puede crear un foco?">
                  No. Viento, temperatura, humedad, lluvia y tormentas contextualizan riesgo y propagación, pero no
                  crean ni confirman incidentes.
                </Faq>
                <Faq question="¿Qué conserva el historial de 90 días?">
                  Incidentes activos, cerrados y archivados, junto con fuentes, estados, notas, asignaciones y
                  auditoría disponibles en ese período.
                </Faq>
                <Faq question="¿Qué información se puede exportar?">
                  Incidentes activos desde el mapa o el comando, además del catálogo de recursos y los registros de
                  mantenimiento.
                </Faq>
                <Faq question="¿Cómo reporto un incendio recibido por llamada o visto en el lugar?">
                  Elegí Reportar foco en el mapa, seleccioná la ubicación o usá la geolocalización disponible y agregá
                  una nota con el origen del aviso y referencias de acceso. El registro comenzará sin confirmar.
                </Faq>
                <Faq question="¿Qué hago si una fuente figura atrasada?">
                  Revisá la hora de su última lectura, continuá con las fuentes disponibles y mantené la verificación
                  por los canales operativos habituales. No interpretes el atraso como ausencia de incendios.
                </Faq>
                <Faq question="¿Por qué un recurso cercano no aparece como disponible?">
                  La distancia y la disponibilidad se calculan con la ubicación, el estado, el mantenimiento y las
                  asignaciones registradas. Revisá la ficha del recurso antes de decidir.
                </Faq>
                <Faq question="¿Archivar elimina el incidente?">
                  No. Lo retira de la operación diaria y conserva fuentes, notas, estados, asignaciones y registro de
                  acciones. También puede restaurarse si vuelve a requerir seguimiento.
                </Faq>
                <Faq question="¿Qué diferencia existe entre extinguir y archivar?">
                  Extinguir registra el final de la etapa activa del incendio. Archivar organiza el ciclo de vida del
                  registro y lo retira de la vista diaria sin borrar su historia.
                </Faq>
                <Faq question="¿Qué conviene escribir en una nota?">
                  Hechos concretos: origen de la novedad, observación realizada, acceso recomendado, unidad involucrada,
                  resultado de la comunicación y próxima revisión acordada.
                </Faq>
                <Faq question="¿Puedo recuperar un incidente cerrado o archivado?">
                  Sí. El historial permite localizarlo, abrir su ficha y restaurarlo cuando la operación vuelva a
                  requerir seguimiento.
                </Faq>
              </div>
            </section>

            <nav className={styles.pageNavigation} aria-label="Navegación entre secciones">
              <Link href="/">
                <span><ArrowLeft size={14} /> Volver</span>
                <strong>Mapa en vivo</strong>
              </Link>
              <Link href="/dashboard" className={styles.nextPage}>
                <span>Siguiente <ArrowRight size={14} /></span>
                <strong>Centro operativo</strong>
              </Link>
            </nav>

            <footer className={styles.docsFooter}>
              <Image src="/openfire-mark.svg" alt="" width={28} height={28} />
              <span>OpenFireDetection · Manual operativo</span>
            </footer>
          </article>
        </main>

        <aside className={styles.toc} aria-label="En esta página">
          <p>En esta página</p>
          <nav>
            {onThisPage.map((item) => (
              <a key={item.href} href={item.href}>{item.title}</a>
            ))}
          </nav>
        </aside>
      </div>

      {searchOpen ? <SearchDialog onClose={() => setSearchOpen(false)} onNavigate={followAnchor} /> : null}
    </div>
  );
}

function DocsHeader({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <button className={styles.menuButton} onClick={onMenu} aria-label="Abrir navegación">
          <Menu size={20} />
        </button>
        <Link href="/" className={styles.brand} aria-label="OpenFireDetection">
          <span className={styles.brandMark}>
            <Image src="/openfire-mark.svg" alt="" fill sizes="34px" className={styles.brandImage} priority />
          </span>
          <strong>OpenFireDetection</strong>
          <span className={styles.docsTag}>Manual</span>
        </Link>

        <button className={styles.searchButton} onClick={onSearch}>
          <Search size={16} />
          <span>Buscar en el manual…</span>
          <kbd>Ctrl K</kbd>
        </button>

        <nav className={styles.headerLinks} aria-label="Accesos del producto">
          <Link href="/">Mapa</Link>
          <Link href="/dashboard">Centro operativo</Link>
          <Link href="/dashboard" className={styles.openProduct}>
            Abrir producto
            <ExternalLink size={14} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function DocsSidebar({
  activeHash,
  open,
  onClose,
  onNavigate,
}: {
  activeHash: string;
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  return (
    <>
      <button className={`${styles.sidebarBackdrop} ${open ? styles.sidebarBackdropOpen : ''}`} onClick={onClose} aria-label="Cerrar navegación" />
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <div className={styles.mobileSidebarHeader}>
          <strong>Documentación</strong>
          <button onClick={onClose} aria-label="Cerrar navegación"><X size={19} /></button>
        </div>
        <nav aria-label="Secciones de la documentación">
          {navigation.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={activeHash === item.href ? styles.navActive : ''}
                  onClick={() => onNavigate(item.href)}
                >
                  <item.icon size={15} />
                  <span>{item.title}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

function SearchDialog({ onClose, onNavigate }: { onClose: () => void; onNavigate: (href: string) => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return allItems.slice(0, 7);
    return allItems.filter((item) =>
      `${item.title} ${item.description} ${item.keywords}`.toLocaleLowerCase('es').includes(normalized)
    );
  }, [query]);

  return (
    <div className={styles.searchOverlay} role="presentation" onMouseDown={onClose}>
      <div className={styles.searchDialog} role="dialog" aria-modal="true" aria-label="Buscar en la documentación" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.searchInputRow}>
          <Search size={19} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar una función, fuente o procedimiento…" />
          <button onClick={onClose}>Esc</button>
        </div>
        <div className={styles.searchResults}>
          <p>{query ? `${results.length} resultados` : 'Secciones principales'}</p>
          {results.length ? results.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => {
                onNavigate(item.href);
                onClose();
              }}
            >
              <span><item.icon size={17} /></span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </div>
              <ChevronRight size={15} />
            </a>
          )) : (
            <div className={styles.noResults}>No hay resultados para “{query}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className={styles.sectionTitle}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function Callout({ icon: Icon, title, tone, children }: { icon: LucideIcon; title: string; tone: 'info' | 'warning' | 'neutral'; children: ReactNode }) {
  return (
    <aside className={`${styles.callout} ${styles[`callout_${tone}`]}`}>
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}

function OverviewCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className={styles.overviewCard}>
      <Icon size={19} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function CheckItem({ children }: { children: ReactNode }) {
  return <li><span><Check size={14} /></span>{children}</li>;
}

function Step({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepNumber}>{number}</div>
      <div><h3>{title}</h3><p>{children}</p></div>
    </div>
  );
}

function IconListItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className={styles.iconListItem}>
      <span><Icon size={18} /></span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const key = status === 'Confirmado' ? 'confirmed' : status === 'Probable' ? 'probable' : status === 'Extinguido' ? 'extinguished' : status === 'Falso positivo' ? 'false' : 'unconfirmed';
  return <span className={`${styles.statusBadge} ${styles[`status_${key}`]}`}>{status}</span>;
}

function Definition({ icon: Icon, term, description }: { icon: LucideIcon; term: string; description: string }) {
  return <div className={styles.definition}><Icon size={18} /><h3>{term}</h3><p>{description}</p></div>;
}

function SourceRole({ role }: { role: string }) {
  const key = role.includes('temprana') ? 'signal' : role.includes('térmic') ? 'evidence' : 'context';
  return <span className={`${styles.sourceRole} ${styles[`source_${key}`]}`}>{role}</span>;
}

function Rule({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <div className={styles.rule}><span>{number}</span><div><h3>{title}</h3><p>{children}</p></div></div>;
}

function SecurityItem({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return <div className={styles.securityItem}><Icon size={19} /><h3>{title}</h3><p>{children}</p></div>;
}

function Faq({ question, children }: { question: string; children: ReactNode }) {
  return <details className={styles.faq}><summary>{question}<ChevronRight size={17} /></summary><p>{children}</p></details>;
}
