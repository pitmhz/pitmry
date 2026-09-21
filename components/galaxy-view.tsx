"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  AlertTriangle,
  Compass,
  RotateCcw,
  Sliders,
  Eye,
  EyeOff,
  ExternalLink,
  Layers,
  Activity,
  Info,
  X,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  GitCommit,
  ShieldCheck,
  Maximize2,
  Route,
  Play,
  Square,
  FileText,
  MessageSquare,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { JourneyStep, JourneyResponse } from "./decision-journey";
import { CodeDiffViewer } from "./code-diff-viewer";

interface GalaxyNode {
  id: string;
  numeric_id: number;
  type: "adr" | "commit" | "grill";
  project: string;
  title: string;
  full_title?: string;
  rationale: string;
  trade_offs?: string;
  tags?: string;
  files?: string;
  commit_hash?: string;
  timestamp?: string;
  base_color: string;
  color: string;
  x: number;
  y: number;
  z: number;
  cluster_id: number;
  cluster_name: string;
  mean_similarity: number;
  isolation_score: number;
  is_anomaly: boolean;
  neighbors: Array<{
    id: string;
    title: string;
    similarity: number;
    type: string;
  }>;
}

interface GalaxyEdge {
  source: string;
  target: string;
  similarity: number;
  weight: number;
}

interface GalaxyCluster {
  id: number;
  name: string;
  color: string;
  count: number;
  centroid: { x: number; y: number; z: number };
}

interface GalaxyData {
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
  clusters: GalaxyCluster[];
  stats: {
    total_nodes: number;
    total_edges: number;
    anomaly_count: number;
    cluster_count: number;
    dimensions: number;
  };
}

interface GalaxyViewProps {
  onSelectNode?: (id: string, type: "adr" | "commit" | "grill") => void;
}

function formatBadge(badge?: string): string {
  switch (badge) {
    case "Design Debate":
      return "Discussion";
    case "ADR Authorized":
      return "Decision";
    case "Current Focus":
      return "Selected";
    case "Implementation":
      return "Code change";
    case "Regression Fix":
      return "Fix";
    case "Follow-up":
      return "Update";
    default:
      return badge || "Step";
  }
}

function formatType(type?: string): string {
  switch (type) {
    case "adr":
      return "Decision";
    case "commit":
      return "Commit";
    case "grill":
      return "Discussion";
    default:
      return type || "Item";
  }
}

export function GalaxyView({ onSelectNode }: GalaxyViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GalaxyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter and Interactive States
  const [selectedNode, setSelectedNode] = useState<GalaxyNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GalaxyNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [anomalyThreshold, setAnomalyThreshold] = useState(0.50);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  // Decision Journey States (Tier 3)
  const [drawerTab, setDrawerTab] = useState<"overview" | "journey">("overview");
  const [journeyMode, setJourneyMode] = useState(false);
  const [journeyChain, setJourneyChain] = useState<JourneyStep[]>([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [isPlayingJourney, setIsPlayingJourney] = useState(false);
  const [activeJourneyStepIndex, setActiveJourneyStepIndex] = useState<number | null>(null);
  const [diffModalNode, setDiffModalNode] = useState<GalaxyNode | null>(null);
  const galaxyAbortRef = useRef<AbortController | null>(null);

  // References to Three.js internal objects for runtime mutations
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    nodeMeshes: Map<string, THREE.Mesh>;
    pulseRings: THREE.Mesh[];
    lineSegments: THREE.LineSegments | null;
    journeyLine: THREE.Line | null;
    targetCamPos: THREE.Vector3 | null;
    targetLookAt: THREE.Vector3 | null;
    animFrameId: number;
  } | null>(null);

  // 1. Fetch Galaxy Data (abortable)
  const fetchGalaxyData = () => {
    galaxyAbortRef.current?.abort();
    const controller = new AbortController();
    galaxyAbortRef.current = controller;
    setLoading(true);
    fetch("/api/memory?action=galaxy", { signal: controller.signal })
      .then((res) => res.json())
      .then((resData: GalaxyData) => {
        if (resData && resData.nodes) {
          setData(resData);
          if (resData.nodes.length > 0 && !selectedNode) {
            // Find first anomaly or first node as default highlight
            const firstAnomaly = resData.nodes.find((n) => n.is_anomaly);
            setSelectedNode(firstAnomaly || resData.nodes[0]);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Failed to load galaxy data:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchGalaxyData();
    return () => galaxyAbortRef.current?.abort();
  }, []);

  // Recalculate dynamic anomalies based on threshold
  const processedNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.map((n) => {
      const isDynamicAnomaly = n.mean_similarity < anomalyThreshold;
      return {
        ...n,
        is_anomaly: isDynamicAnomaly,
        color: isDynamicAnomaly ? "#ef4444" : n.base_color
      };
    });
  }, [data, anomalyThreshold]);

  // Filtered nodes based on active filters
  const filteredNodes = useMemo(() => {
    return processedNodes.filter((n) => {
      if (anomaliesOnly && !n.is_anomaly) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      if (selectedClusterId !== null && n.cluster_id !== selectedClusterId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.project.toLowerCase().includes(q) ||
          (n.rationale ? n.rationale.toLowerCase().includes(q) : false)
        );
      }
      return true;
    });
  }, [processedNodes, anomaliesOnly, typeFilter, selectedClusterId, searchQuery]);

  // Handle Escape key to close modal or drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (diffModalNode) {
          setDiffModalNode(null);
        } else if (selectedNode) {
          setSelectedNode(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diffModalNode, selectedNode]);

  const isDynamicAnomaly = (n: GalaxyNode) => {
    return n.mean_similarity < anomalyThreshold;
  };

  // Fly Camera to Node
  const flyToNode = (node: GalaxyNode) => {
    if (!threeRef.current) return;
    const target = new THREE.Vector3(node.x, node.y, node.z);
    // Camera position offset slightly back and above
    const camOffset = new THREE.Vector3(node.x + 25, node.y + 18, node.z + 55);

    threeRef.current.targetCamPos = camOffset;
    threeRef.current.targetLookAt = target;
  };

  // 2. Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current || !data) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07090e");
    scene.fog = new THREE.FogExp2("#07090e", 0.0018);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.set(0, 45, 230);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 650;
    controls.minDistance = 15;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.5;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 2, 400);
    pointLight.position.set(0, 100, 100);
    scene.add(pointLight);

    // Background Starfield Dust (1,000 deep space particles)
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      starPositions[idx] = (Math.random() - 0.5) * 1000;
      starPositions[idx + 1] = (Math.random() - 0.5) * 800;
      starPositions[idx + 2] = (Math.random() - 0.5) * 1000;

      const c = new THREE.Color(
        i % 3 === 0 ? "#38bdf8" : i % 3 === 1 ? "#818cf8" : "#94a3b8"
      );
      starColors[idx] = c.r;
      starColors[idx + 1] = c.g;
      starColors[idx + 2] = c.b;
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Node Meshes Map
    const nodeMeshes = new Map<string, THREE.Mesh>();
    const pulseRings: THREE.Mesh[] = [];

    // Sphere geometry templates
    const adrGeo = new THREE.SphereGeometry(3.0, 24, 24);
    const commitGeo = new THREE.SphereGeometry(2.2, 20, 20);
    const grillGeo = new THREE.SphereGeometry(3.6, 24, 24);

    // Map nodes to 3D meshes
    processedNodes.forEach((node) => {
      let geo = adrGeo;
      if (node.type === "commit") geo = commitGeo;
      if (node.type === "grill") geo = grillGeo;

      const nodeColor = new THREE.Color(node.color);
      const mat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: node.is_anomaly ? 1.4 : 0.6,
        roughness: 0.2,
        metalness: 0.8
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(node.x, node.y, node.z);
      mesh.userData = { node };
      scene.add(mesh);
      nodeMeshes.set(node.id, mesh);

      // Anomaly Concentric Rings
      if (node.is_anomaly) {
        const ringGeo = new THREE.RingGeometry(3.8, 4.4, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(mesh.position);
        ringMesh.lookAt(camera.position);
        ringMesh.userData = { parentNode: node, baseScale: 1.0 };
        scene.add(ringMesh);
        pulseRings.push(ringMesh);
      }
    });

    // Constellation Filament Lines
    let lineSegments: THREE.LineSegments | null = null;
    if (data.edges && data.edges.length > 0) {
      const linePositions: number[] = [];
      const lineColors: number[] = [];

      data.edges.forEach((edge) => {
        const sourceMesh = nodeMeshes.get(edge.source);
        const targetMesh = nodeMeshes.get(edge.target);

        if (sourceMesh && targetMesh) {
          linePositions.push(
            sourceMesh.position.x,
            sourceMesh.position.y,
            sourceMesh.position.z,
            targetMesh.position.x,
            targetMesh.position.y,
            targetMesh.position.z
          );

          // Alpha color scaled by similarity
          const edgeCol = new THREE.Color(0x38bdf8);
          lineColors.push(edgeCol.r, edgeCol.g, edgeCol.b, edgeCol.r, edgeCol.g, edgeCol.b);
        }
      });

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
      lineGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));

      const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        linewidth: 1.2
      });

      lineSegments = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(lineSegments);
    }

    // Raycaster for Hover & Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(nodeMeshes.values()));

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const node = hit.userData.node as GalaxyNode;
        container.style.cursor = "pointer";
        setHoveredNode(node);
      } else {
        container.style.cursor = "default";
        setHoveredNode(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(nodeMeshes.values()));

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const node = hit.userData.node as GalaxyNode;
        flyToNode(node);
        setSelectedNode(node);
        if (onSelectNode) {
          onSelectNode(node.id, node.type);
        }
      }
    };

    container.addEventListener("mousemove", handlePointerMove);
    container.addEventListener("click", handleClick);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Save Three refs
    threeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      nodeMeshes,
      pulseRings,
      lineSegments,
      journeyLine: null,
      targetCamPos: null,
      targetLookAt: null,
      animFrameId: 0
    };

    // Render Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Pulse anomaly rings
      pulseRings.forEach((ring, idx) => {
        const scale = 1.0 + 0.35 * Math.sin(elapsed * 4 + idx);
        ring.scale.set(scale, scale, 1);
        ring.lookAt(camera.position);
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + 0.4 * Math.sin(elapsed * 4 + idx);
      });

      // Smooth camera interpolation towards target
      if (threeRef.current?.targetCamPos && threeRef.current?.targetLookAt) {
        camera.position.lerp(threeRef.current.targetCamPos, 0.05);
        controls.target.lerp(threeRef.current.targetLookAt, 0.05);

        if (camera.position.distanceTo(threeRef.current.targetCamPos) < 1.0) {
          threeRef.current.targetCamPos = null;
          threeRef.current.targetLookAt = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      threeRef.current!.animFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup: dispose geometries/materials for every created GPU resource
    return () => {
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animFrameId);
        if (threeRef.current.journeyLine) {
          threeRef.current.scene.remove(threeRef.current.journeyLine);
          threeRef.current.journeyLine.geometry.dispose();
          (threeRef.current.journeyLine.material as THREE.Material).dispose();
          threeRef.current.journeyLine = null;
        }
        threeRef.current.nodeMeshes.forEach((mesh) => {
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        });
        threeRef.current.nodeMeshes.clear();
        threeRef.current.pulseRings.forEach((ring) => {
          ring.geometry.dispose();
          (ring.material as THREE.Material).dispose();
        });
        if (threeRef.current.lineSegments) {
          threeRef.current.lineSegments.geometry.dispose();
          (threeRef.current.lineSegments.material as THREE.Material).dispose();
          threeRef.current.scene.remove(threeRef.current.lineSegments);
          threeRef.current.lineSegments = null;
        }
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose?.();
          }
        });
        threeRef.current.controls.dispose();
        threeRef.current.renderer.dispose();
        threeRef.current = null;
      }
      container.removeEventListener("mousemove", handlePointerMove);
      container.removeEventListener("click", handleClick);
      resizeObserver.disconnect();
    };
  }, [data]);

  // Synchronize dynamic visibility, opacity & colors based on state filters and journey mode
  useEffect(() => {
    if (!threeRef.current) return;
    const { nodeMeshes, pulseRings, lineSegments } = threeRef.current;
    const filteredIdSet = new Set(filteredNodes.map((n) => n.id));
    const journeyNodeIds = journeyMode && journeyChain.length > 0
      ? new Set(journeyChain.map((s) => s.node.id))
      : null;

    nodeMeshes.forEach((mesh, id) => {
      const node = mesh.userData.node as GalaxyNode;
      const isVisible = filteredIdSet.has(id);
      const isSelected = selectedNode?.id === id;
      const isHovered = hoveredNode?.id === id;
      const isJourneyStep = journeyNodeIds ? journeyNodeIds.has(id) : false;

      mesh.visible = isVisible;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (journeyMode && journeyNodeIds) {
        if (isJourneyStep) {
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.color.set(isDynamicAnomaly(node) ? "#ef4444" : node.base_color);
          mat.emissive.set(isDynamicAnomaly(node) ? "#ef4444" : node.base_color);
          mat.emissiveIntensity = isSelected || isHovered ? 2.8 : 2.0;
          mesh.scale.set(1.4, 1.4, 1.4);
        } else {
          mat.transparent = true;
          mat.opacity = 0.12;
          mat.emissiveIntensity = 0.05;
          mesh.scale.set(0.7, 0.7, 0.7);
        }
      } else {
        mat.transparent = false;
        mat.opacity = 1.0;
        if (isDynamicAnomaly(node)) {
          mat.color.setHex(0xef4444);
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = isSelected || isHovered ? 2.0 : 1.2;
        } else {
          mat.color.set(node.base_color);
          mat.emissive.set(node.base_color);
          mat.emissiveIntensity = isSelected || isHovered ? 1.5 : 0.5;
        }

        if (isSelected || isHovered) {
          mesh.scale.set(1.45, 1.45, 1.45);
        } else {
          mesh.scale.set(1.0, 1.0, 1.0);
        }
      }
    });

    if (lineSegments) {
      const lineMat = lineSegments.material as THREE.LineBasicMaterial;
      lineMat.opacity = journeyMode ? 0.06 : 0.28;
    }

    pulseRings.forEach((ring) => {
      const node = ring.userData.parentNode as GalaxyNode;
      ring.visible = filteredIdSet.has(node.id) && isDynamicAnomaly(node) && (!journeyMode || !journeyNodeIds || journeyNodeIds.has(node.id));
    });
  }, [filteredNodes, selectedNode, hoveredNode, anomalyThreshold, journeyMode, journeyChain]);

  // Fetch Decision Journey Data when journeyMode is active or node changes
  useEffect(() => {
    if (!journeyMode || !selectedNode) {
      setJourneyChain([]);
      setIsPlayingJourney(false);
      setActiveJourneyStepIndex(null);
      if (threeRef.current?.journeyLine) {
        threeRef.current.scene.remove(threeRef.current.journeyLine);
        threeRef.current.journeyLine.geometry.dispose();
        (threeRef.current.journeyLine.material as THREE.Material).dispose();
        threeRef.current.journeyLine = null;
      }
      return;
    }

    setJourneyLoading(true);
    fetch(
      `/api/memory?action=journey&item_type=${selectedNode.type}&item_id=${selectedNode.numeric_id}&hops=3`
    )
      .then((res) => res.json())
      .then((jData: JourneyResponse) => {
        if (jData && jData.journey_chain) {
          setJourneyChain(jData.journey_chain);
        }
        setJourneyLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load journey in galaxy:", err);
        setJourneyLoading(false);
      });
  }, [journeyMode, selectedNode?.id]);

  // Render Glowing Celestial Flight Path Line for Journey
  useEffect(() => {
    if (!threeRef.current) return;
    const { scene, nodeMeshes } = threeRef.current;

    // Dispose old line
    if (threeRef.current.journeyLine) {
      scene.remove(threeRef.current.journeyLine);
      threeRef.current.journeyLine.geometry.dispose();
      (threeRef.current.journeyLine.material as THREE.Material).dispose();
      threeRef.current.journeyLine = null;
    }

    if (!journeyMode || journeyChain.length < 2) return;

    const points: THREE.Vector3[] = [];
    journeyChain.forEach((step) => {
      const mesh = nodeMeshes.get(step.node.id);
      if (mesh) {
        points.push(mesh.position.clone());
      }
    });

    if (points.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(points);
      const curvePoints = curve.getPoints(points.length * 15);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xf97316,
        linewidth: 2.5,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const jLine = new THREE.Line(lineGeo, lineMat);
      scene.add(jLine);
      threeRef.current.journeyLine = jLine;
    }
  }, [journeyMode, journeyChain]);

  // Autoplay flight path through the journey
  useEffect(() => {
    if (!isPlayingJourney || journeyChain.length === 0) return;

    const timer = setInterval(() => {
      setActiveJourneyStepIndex((prev) => {
        const nextIdx = prev === null ? 0 : prev + 1;
        if (nextIdx >= journeyChain.length) {
          setIsPlayingJourney(false);
          return null;
        }
        const nextStep = journeyChain[nextIdx];
        const targetNode = processedNodes.find((n) => n.id === nextStep.node.id);
        if (targetNode) {
          flyToNode(targetNode);
          setSelectedNode(targetNode);
        }
        return nextIdx;
      });
    }, 2800);

    return () => clearInterval(timer);
  }, [isPlayingJourney, journeyChain, processedNodes]);

  const togglePlayJourney = () => {
    if (isPlayingJourney) {
      setIsPlayingJourney(false);
    } else {
      setIsPlayingJourney(true);
      setActiveJourneyStepIndex(0);
      if (journeyChain.length > 0) {
        const firstStep = journeyChain[0];
        const targetNode = processedNodes.find((n) => n.id === firstStep.node.id);
        if (targetNode) {
          flyToNode(targetNode);
          setSelectedNode(targetNode);
        }
      }
    }
  };

  // Synchronize autoRotate
  useEffect(() => {
    if (threeRef.current) {
      threeRef.current.controls.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Fly Camera to Cluster Centroid
  const flyToCluster = (cluster: GalaxyCluster) => {
    if (!threeRef.current) return;
    const target = new THREE.Vector3(
      cluster.centroid.x,
      cluster.centroid.y,
      cluster.centroid.z
    );
    const camOffset = new THREE.Vector3(
      cluster.centroid.x,
      cluster.centroid.y + 40,
      cluster.centroid.z + 140
    );

    threeRef.current.targetCamPos = camOffset;
    threeRef.current.targetLookAt = target;
  };

  // Reset Camera
  const resetCamera = () => {
    if (!threeRef.current) return;
    threeRef.current.targetCamPos = new THREE.Vector3(0, 45, 230);
    threeRef.current.targetLookAt = new THREE.Vector3(0, 0, 0);
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#07090e]">
      {/* 1. Main 3D Canvas Mount */}
      <div ref={mountRef} className="h-full w-full flex-1 outline-none" />

      {/* 2. Top-Left Galaxy HUD Overlay */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {/* Title & Stats */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/90 p-3 shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 font-mono text-xs font-semibold">
            384D
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                3D Map
              </span>
              <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                384D
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{data?.stats?.total_nodes || 39} items</span>
              <span>•</span>
              <span>{data?.stats?.total_edges || 31} connections</span>
              <span>•</span>
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                {processedNodes.filter(n => n.is_anomaly).length} outliers
              </span>
            </div>
          </div>
        </div>

        {/* Filter Pills & Spotlight */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card/85 p-1.5 backdrop-blur-md pointer-events-auto">
          <Button
            type="button"
            variant={typeFilter === null && !anomaliesOnly && selectedClusterId === null ? "odysseyui" : "ghost"}
            size="xs"
            onClick={() => {
              setTypeFilter(null);
              setAnomaliesOnly(false);
              setSelectedClusterId(null);
            }}
            className="h-7 text-[11px]"
          >
            All items
          </Button>
          <Button
            type="button"
            variant={typeFilter === "adr" ? "odysseyui" : "ghost"}
            size="xs"
            onClick={() => setTypeFilter(typeFilter === "adr" ? null : "adr")}
            className="h-7 text-[11px]"
          >
            Decisions
          </Button>
          <Button
            type="button"
            variant={typeFilter === "commit" ? "odysseyui" : "ghost"}
            size="xs"
            onClick={() => setTypeFilter(typeFilter === "commit" ? null : "commit")}
            className="h-7 text-[11px]"
          >
            Commits
          </Button>
          <Button
            type="button"
            variant={anomaliesOnly ? "destructive" : "outline"}
            size="xs"
            onClick={() => setAnomaliesOnly(!anomaliesOnly)}
            className="ml-auto gap-1 h-7 text-[11px] font-semibold"
          >
            <AlertTriangle className="h-3 w-3" />
            Show outliers
          </Button>
        </div>

        {/* Topic Groups Quick Jump */}
        {data?.clusters && (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-card/85 p-2 backdrop-blur-md pointer-events-auto">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Topic Groups
            </span>
            <div className="grid grid-cols-2 gap-1 mt-0.5">
              {data.clusters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (selectedClusterId === c.id) {
                      setSelectedClusterId(null);
                    } else {
                      setSelectedClusterId(c.id);
                      flyToCluster(c);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1 text-[10px] font-medium transition-colors text-left",
                    selectedClusterId === c.id
                      ? "bg-secondary text-foreground border border-border font-semibold"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span className="truncate max-w-[120px]">{c.name}</span>
                  <span className="font-mono text-[9px] text-muted-foreground ml-1">
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Top-Right Search & Sensitivity Slider */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        {/* Search in Map */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search map..."
            className="w-56 rounded-lg border border-border bg-card/90 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground backdrop-blur-md focus:border-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Outlier Threshold Slider Menu */}
        <div className="group relative">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground backdrop-blur-md"
            title="Outlier sensitivity"
          >
            <Sliders className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-mono text-[11px]">&lt; {anomalyThreshold.toFixed(2)}</span>
          </button>
          <div className="absolute right-0 mt-1 hidden w-64 flex-col gap-2 rounded-xl border border-border bg-card p-3.5 shadow-2xl backdrop-blur-md group-hover:flex">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Outlier cutoff</span>
              <span className="font-mono text-rose-400 font-bold">{anomalyThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.70"
              step="0.02"
              value={anomalyThreshold}
              onChange={(e) => setAnomalyThreshold(parseFloat(e.target.value))}
              className="accent-rose-500 cursor-pointer"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Items with similarity below this cutoff are marked in red as outliers.
            </p>
          </div>
        </div>

        {/* Auto-Rotate Toggle */}
        <Button
          type="button"
          variant={autoRotate ? "odysseyui" : "outline"}
          size="icon-sm"
          onClick={() => setAutoRotate(!autoRotate)}
          className="backdrop-blur-md"
          title={autoRotate ? "Pause rotation" : "Start rotation"}
        >
          <Compass className="h-3.5 w-3.5" />
        </Button>

        {/* Reset Camera */}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={resetCamera}
          className="backdrop-blur-md"
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 4. Hover Micro-Tooltip */}
      {hoveredNode && !selectedNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card/95 px-3.5 py-2 shadow-2xl backdrop-blur-md">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: hoveredNode.color }}
            />
            <span className="text-xs font-semibold text-foreground max-w-sm truncate">
              {hoveredNode.title}
            </span>
            <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
              {formatType(hoveredNode.type)}
            </span>
            {isDynamicAnomaly(hoveredNode) && (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-500/30">
                Outlier
              </span>
            )}
          </div>
        </div>
      )}

      {/* 5. Slide-Out Star Inspector Drawer (Right Panel) */}
      {selectedNode && (
        <div className="absolute right-0 top-0 bottom-0 z-30 flex w-96 flex-col border-l border-border bg-card/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border p-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedNode.color }}
                />
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {selectedNode.project} • {formatType(selectedNode.type)} #{selectedNode.numeric_id}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-foreground leading-snug">
                {selectedNode.title}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSelectedNode(null)}
              className="text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Drawer Tab Switcher */}
          <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/60 p-0.5">
              <Button
                type="button"
                variant={drawerTab === "overview" ? "odysseyui" : "ghost"}
                size="xs"
                onClick={() => {
                  setDrawerTab("overview");
                  setJourneyMode(false);
                }}
                className="h-7 text-xs"
              >
                Overview
              </Button>
              <Button
                type="button"
                variant={drawerTab === "journey" ? "odysseyui" : "ghost"}
                size="xs"
                onClick={() => {
                  setDrawerTab("journey");
                  setJourneyMode(true);
                }}
                className="h-7 text-xs gap-1.5"
              >
                <Route className="h-3.5 w-3.5" />
                <span>Decision Path</span>
              </Button>
            </div>

            {drawerTab === "journey" && journeyChain.length > 0 && (
              <Button
                type="button"
                variant={isPlayingJourney ? "secondary" : "odysseyui"}
                size="xs"
                onClick={togglePlayJourney}
                className="gap-1 h-7 text-[11px] font-semibold"
                title="Play camera tour along each step"
              >
                {isPlayingJourney ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop tour</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 fill-current" />
                    <span>Play tour</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Drawer Body: Journey vs Overview */}
          {drawerTab === "journey" ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Journey Banner */}
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Route className="h-4 w-4 shrink-0" />
                    <span>Decision path</span>
                  </div>
                  <span className="font-mono text-[10px] text-primary font-bold">
                    {journeyChain.length} steps
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  Shows how this item started and what happened next in order.
                </p>
              </div>

              {journeyLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-xs text-muted-foreground space-y-2">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>Tracing path...</span>
                </div>
              ) : journeyChain.length === 0 ? (
                <div className="rounded-lg border border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground italic">
                  No path found for this item.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {journeyChain.map((step, idx) => {
                    const isFocal = step.node.id === selectedNode.id;
                    const isTourActive = isPlayingJourney && activeJourneyStepIndex === idx;

                    return (
                      <div
                        key={`${step.step}-${step.node.id}`}
                        onClick={() => {
                          const targetNode = processedNodes.find((n) => n.id === step.node.id);
                          if (targetNode) {
                            flyToNode(targetNode);
                            setSelectedNode(targetNode);
                          }
                        }}
                        className={cn(
                          "cursor-pointer rounded-lg border p-3 transition-all duration-200 group text-left",
                          isTourActive
                            ? "border-amber-500 bg-amber-500/15 shadow-md shadow-amber-500/20"
                            : isFocal
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-secondary/20 hover:border-primary/40 hover:bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-mono font-bold text-foreground border border-border">
                              {step.step}
                            </span>
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border border-border bg-secondary text-muted-foreground font-medium">
                              {formatBadge(step.badge)}
                            </span>
                          </div>
                          {step.similarity < 1.0 && (
                            <span className="font-mono text-[10px] text-primary">
                              {(step.similarity * 100).toFixed(0)}% match
                            </span>
                          )}
                        </div>

                        <div
                          className={cn(
                            "text-xs font-semibold leading-snug line-clamp-2",
                            isFocal ? "text-primary" : "text-foreground group-hover:text-primary"
                          )}
                        >
                          {step.node.title}
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span>
                            {step.node.project} • {formatType(step.node.type)} #{step.node.numeric_id}
                          </span>
                          <span className="text-primary font-medium group-hover:underline flex items-center gap-0.5">
                            Fly to item <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Anomaly Callout */}
              {isDynamicAnomaly(selectedNode) ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>Unusual item (Outlier)</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-rose-200/80 leading-relaxed">
                    This item is far from other records (average match:{" "}
                    <strong className="font-mono text-white">
                      {(selectedNode.mean_similarity * 100).toFixed(0)}%
                    </strong>
                    ). It may be a unique decision or need more context.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-secondary/30 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Well connected</span>
                  </div>
                  <span className="font-mono text-xs text-primary font-semibold">
                    {(selectedNode.mean_similarity * 100).toFixed(0)}%
                  </span>
                </div>
              )}

            {/* Semantic Gauges */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Distance from other items</span>
                <span className="font-mono text-foreground">
                  {(selectedNode.isolation_score * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${selectedNode.isolation_score * 100}%`,
                    backgroundColor: isDynamicAnomaly(selectedNode) ? "#ef4444" : "var(--primary)"
                  }}
                />
              </div>
            </div>

            {/* Constellation Cluster */}
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Topic group
              </span>
              <div className="text-xs font-medium text-foreground mt-0.5">
                {selectedNode.cluster_name}
              </div>
            </div>

            {/* Architectural Rationale */}
            {selectedNode.rationale && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Context
                </span>
                <div className="mt-1.5 rounded-lg border border-border/70 bg-secondary/30 p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedNode.rationale}
                </div>
              </div>
            )}

            {/* Trade-offs or Files Changed */}
            {selectedNode.trade_offs && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Trade-offs
                </span>
                <div className="mt-1.5 rounded-lg border border-border/70 bg-secondary/30 p-3 text-xs text-muted-foreground leading-relaxed">
                  {selectedNode.trade_offs}
                </div>
              </div>
            )}

            {selectedNode.files && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Files changed
                </span>
                <div className="mt-1.5 rounded-lg border border-border/70 bg-secondary/30 p-2.5 text-[11px] font-mono text-muted-foreground break-all leading-normal">
                  {selectedNode.files}
                </div>
              </div>
            )}

            {selectedNode.commit_hash && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <span>Code diff</span>
                  <button
                    onClick={() => setDiffModalNode(selectedNode)}
                    className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    Compare code →
                  </button>
                </div>
                <button
                  onClick={() => setDiffModalNode(selectedNode)}
                  className="w-full rounded-lg border border-border/70 bg-secondary/30 p-2.5 text-left text-xs font-mono text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors flex items-center justify-between group"
                >
                  <span className="font-semibold text-foreground">#{selectedNode.commit_hash}</span>
                  <span className="text-[10px] text-primary group-hover:underline">Open diff viewer</span>
                </button>
              </div>
            )}

            {/* Closest Semantic Neighbors */}
            {selectedNode.neighbors && selectedNode.neighbors.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Related items</span>
                  <span className="text-[10px] font-mono text-primary">Top 3 matches</span>
                </span>
                <div className="mt-2 space-y-1.5">
                  {selectedNode.neighbors.map((nbr) => (
                    <button
                      key={nbr.id}
                      onClick={() => {
                        const fullNode = processedNodes.find((n) => n.id === nbr.id);
                        if (fullNode) {
                          setSelectedNode(fullNode);
                          flyToNode(fullNode);
                        }
                      }}
                      className="w-full text-left rounded-lg border border-border bg-secondary/30 p-2 hover:bg-secondary/70 transition-colors flex items-center justify-between group"
                    >
                      <div className="truncate pr-2">
                        <div className="text-xs text-foreground group-hover:text-primary truncate">
                          {nbr.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {nbr.id}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-primary">
                          {(nbr.similarity * 100).toFixed(0)}%
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Drawer Footer Actions */}
          <div className="border-t border-border p-3 bg-secondary/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => flyToNode(selectedNode)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Center on item
              </button>
              {drawerTab === "overview" && (
                <button
                  onClick={() => {
                    setDrawerTab("journey");
                    setJourneyMode(true);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  <Route className="h-3.5 w-3.5" />
                  Show path
                </button>
              )}
            </div>
            {onSelectNode && (
              <Button
                type="button"
                variant="odysseyui"
                size="xs"
                onClick={() => onSelectNode(selectedNode.id, selectedNode.type)}
                className="gap-1 h-7"
              >
                <span>Open in list</span>
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen / Expanded Diff Modal */}
      {diffModalNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-in fade-in-0 duration-150 cursor-pointer"
          onClick={() => setDiffModalNode(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Galaxy Diff Viewer"
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <CodeDiffViewer
              project={diffModalNode.project}
              commitHash={diffModalNode.commit_hash}
              itemId={diffModalNode.numeric_id}
              isModal={true}
              onClose={() => setDiffModalNode(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
