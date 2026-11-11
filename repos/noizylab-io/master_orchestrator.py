#!/usr/bin/env python3
"""
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   🔗 MASTER INTEGRATION & ORCHESTRATION LAYER                            ║
║                                                                           ║
║   Connects: gRPC ↔ File Sync ↔ Auth ↔ Display ↔ Metrics                 ║
║   Unified command pipeline and event routing                              ║
║   Cross-node state synchronization                                        ║
║   Health monitoring and auto-recovery                                     ║
║   Single point of contact for all cluster operations                      ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import logging
import json
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
import uuid

# Local imports (would be: from .noizylab_grpc_bridge import NoizyGridRPCService)
# from .unified_file_sync import UnifiedSyncOrchestrator
# from .unified_auth_manager import UnifiedAuthService
# from .unified_remote_display import UnifiedRemoteDisplay
# from .unified_performance_metrics import UnifiedMetricsCollector

# ═══════════════════════════════════════════════════════════════════════════
# EVENT MODEL
# ═══════════════════════════════════════════════════════════════════════════

class EventType(Enum):
    """Events flowing through the cluster"""
    
    # gRPC events
    TASK_CREATED = "task.created"
    TASK_STARTED = "task.started"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    
    # File sync events
    FILE_CHANGED = "file.changed"
    FILE_SYNCED = "file.synced"
    SYNC_CONFLICT = "sync.conflict"
    
    # Auth events
    AUTH_TOKEN_CREATED = "auth.token.created"
    AUTH_TOKEN_EXPIRED = "auth.token.expired"
    AUTH_FAILED = "auth.failed"
    
    # Display events
    DISPLAY_STREAM_STARTED = "display.stream.started"
    DISPLAY_STREAM_STOPPED = "display.stream.stopped"
    DISPLAY_INPUT = "display.input"
    
    # Node events
    NODE_JOINED = "node.joined"
    NODE_LEFT = "node.left"
    NODE_UNHEALTHY = "node.unhealthy"
    NODE_HEALTHY = "node.healthy"
    
    # System events
    SYSTEM_ALERT = "system.alert"
    METRICS_UPDATED = "metrics.updated"

@dataclass
class Event:
    """Cluster event"""
    event_id: str
    event_type: EventType
    source_node: str
    timestamp: datetime
    data: Dict[str, Any]
    
    def to_dict(self) -> Dict:
        return {
            "id": self.event_id,
            "type": self.event_type.value,
            "source": self.source_node,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data
        }

# ═══════════════════════════════════════════════════════════════════════════
# EVENT BUS (In-memory pub/sub)
# ═══════════════════════════════════════════════════════════════════════════

class EventBus:
    """Publish-subscribe event system for cluster"""
    
    def __init__(self):
        self.logger = logging.getLogger("EventBus")
        self.subscribers: Dict[EventType, List[Callable]] = {}
        self.event_log: List[Event] = []
    
    def subscribe(self, event_type: EventType, callback: Callable) -> None:
        """Subscribe to event type"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
        self.logger.debug(f"📮 Subscriber added for {event_type.value}")
    
    async def publish(self, event: Event) -> None:
        """Publish event to subscribers"""
        # Log event
        self.event_log.append(event)
        
        # Keep only last 10k events
        if len(self.event_log) > 10000:
            self.event_log = self.event_log[-10000:]
        
        # Notify subscribers
        if event.event_type in self.subscribers:
            for callback in self.subscribers[event.event_type]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event)
                    else:
                        callback(event)
                except Exception as e:
                    self.logger.error(f"❌ Subscriber error: {e}")
    
    def get_event_log(self, event_type: Optional[EventType] = None, limit: int = 100) -> List[Dict]:
        """Get recent events"""
        events = self.event_log
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return [e.to_dict() for e in events[-limit:]]

# ═══════════════════════════════════════════════════════════════════════════
# NODE REGISTRY
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class NodeInfo:
    """Registered cluster node"""
    node_id: str
    node_name: str
    address: str
    port: int
    os: str
    role: str  # "primary", "compute", "secondary"
    
    # Health
    is_healthy: bool = True
    last_heartbeat: datetime = None
    consecutive_failures: int = 0
    
    # Capabilities
    capabilities: List[str] = None  # "grpc", "file_sync", "gpu", etc.
    
    def __post_init__(self):
        if self.capabilities is None:
            self.capabilities = []
        if self.last_heartbeat is None:
            self.last_heartbeat = datetime.now()

class NodeRegistry:
    """Track and manage cluster nodes"""
    
    def __init__(self, event_bus: EventBus):
        self.logger = logging.getLogger("NodeRegistry")
        self.event_bus = event_bus
        self.nodes: Dict[str, NodeInfo] = {}
    
    async def register(self, node_info: NodeInfo) -> None:
        """Register a node"""
        self.nodes[node_info.node_id] = node_info
        self.logger.info(f"✅ Registered node: {node_info.node_name}")
        
        await self.event_bus.publish(Event(
            event_id=str(uuid.uuid4()),
            event_type=EventType.NODE_JOINED,
            source_node=node_info.node_name,
            timestamp=datetime.now(),
            data={"node": node_info.node_name, "address": node_info.address}
        ))
    
    async def deregister(self, node_id: str) -> None:
        """Deregister a node"""
        if node_id in self.nodes:
            node = self.nodes[node_id]
            del self.nodes[node_id]
            self.logger.info(f"❌ Deregistered node: {node.node_name}")
            
            await self.event_bus.publish(Event(
                event_id=str(uuid.uuid4()),
                event_type=EventType.NODE_LEFT,
                source_node=node.node_name,
                timestamp=datetime.now(),
                data={"node": node.node_name}
            ))
    
    async def update_health(self, node_id: str, is_healthy: bool) -> None:
        """Update node health status"""
        if node_id not in self.nodes:
            return
        
        node = self.nodes[node_id]
        node.last_heartbeat = datetime.now()
        
        if is_healthy:
            node.consecutive_failures = 0
            if not node.is_healthy:
                node.is_healthy = True
                self.logger.info(f"💚 Node recovered: {node.node_name}")
                
                await self.event_bus.publish(Event(
                    event_id=str(uuid.uuid4()),
                    event_type=EventType.NODE_HEALTHY,
                    source_node=node.node_name,
                    timestamp=datetime.now(),
                    data={"node": node.node_name}
                ))
        else:
            node.consecutive_failures += 1
            if node.consecutive_failures >= 3:
                node.is_healthy = False
                self.logger.warning(f"💔 Node marked unhealthy: {node.node_name}")
                
                await self.event_bus.publish(Event(
                    event_id=str(uuid.uuid4()),
                    event_type=EventType.NODE_UNHEALTHY,
                    source_node=node.node_name,
                    timestamp=datetime.now(),
                    data={"node": node.node_name, "failures": node.consecutive_failures}
                ))
    
    def get_nodes(self, healthy_only: bool = False) -> List[NodeInfo]:
        """Get nodes"""
        nodes = list(self.nodes.values())
        if healthy_only:
            nodes = [n for n in nodes if n.is_healthy]
        return nodes
    
    def get_node(self, node_id: str) -> Optional[NodeInfo]:
        """Get single node"""
        return self.nodes.get(node_id)

# ═══════════════════════════════════════════════════════════════════════════
# MASTER ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════

class NOIZYLABMasterOrchestrator:
    """
    Master orchestration layer coordinating all cluster subsystems.
    
    Architecture:
    
        ┌──────────────────────────────────────────────────┐
        │         MasterOrchestrator                        │
        │  ┌────────────────────────────────────────────┐   │
        │  │ Event Bus (Pub/Sub)                        │   │
        │  └────────────────────────────────────────────┘   │
        │          ↑    ↑    ↑    ↑    ↑    ↑              │
        ├──────────┼────┼────┼────┼────┼────┼──────────────┤
        │          │    │    │    │    │    │              │
        │    ┌─────┴─┐  │    │    │    │    │              │
        │    │gRPC   │  │    │    │    │    │              │
        │    │Bridge │  │    │    │    │    │              │
        │    └───────┘  │    │    │    │    │              │
        │               │    │    │    │    │              │
        │         ┌─────┴──┐ │    │    │    │              │
        │         │File    │ │    │    │    │              │
        │         │Sync    │ │    │    │    │              │
        │         └────────┘ │    │    │    │              │
        │                    │    │    │    │              │
        │              ┌─────┴──┐ │    │    │              │
        │              │Display │ │    │    │              │
        │              │Service │ │    │    │              │
        │              └────────┘ │    │    │              │
        │                         │    │    │              │
        │                   ┌─────┴──┐ │    │              │
        │                   │Auth    │ │    │              │
        │                   │Manager │ │    │              │
        │                   └────────┘ │    │              │
        │                              │    │              │
        │                        ┌─────┴──┐ │              │
        │                        │Metrics │ │              │
        │                        │Collect │ │              │
        │                        └────────┘ │              │
        │                                   │              │
        │                            ┌──────┴──┐           │
        │                            │Node Reg  │           │
        │                            │Registry  │           │
        │                            └──────────┘           │
        │                                                   │
        └──────────────────────────────────────────────────┘
    """
    
    def __init__(self, cluster_name: str = "NOIZYLAB"):
        self.cluster_name = cluster_name
        self.logger = logging.getLogger(f"Orchestrator[{cluster_name}]")
        
        # Core subsystems
        self.event_bus = EventBus()
        self.node_registry = NodeRegistry(self.event_bus)
        
        # Placeholders for integrated subsystems
        # self.grpc_bridge = NoizyGridRPCService()
        # self.file_sync = UnifiedSyncOrchestrator()
        # self.auth_service = UnifiedAuthService()
        # self.display_service = UnifiedRemoteDisplay()
        # self.metrics_collector = UnifiedMetricsCollector(cluster_name)
        
        self.is_running = False
        self.start_time = None
    
    async def start(self) -> None:
        """Start orchestrator and all subsystems"""
        try:
            self.logger.info(f"🚀 Starting NOIZYLAB {self.cluster_name} cluster orchestrator...")
            self.is_running = True
            self.start_time = datetime.now()
            
            # TODO: Start each subsystem
            # await self.grpc_bridge.start_server()
            # await self.file_sync.start()
            # await self.auth_service.initialize()
            # await self._health_monitor_loop()
            
            self.logger.info("✅ Orchestrator started successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Startup failed: {e}")
            self.is_running = False
            raise
    
    async def stop(self) -> None:
        """Stop orchestrator and all subsystems"""
        self.logger.info("🛑 Stopping orchestrator...")
        self.is_running = False
        
        # TODO: Stop each subsystem
        # await self.grpc_bridge.stop()
        # await self.file_sync.stop()
        
        self.logger.info("✅ Orchestrator stopped")
    
    # ─────────────────────────────────────────────────────────────────────
    # Task Execution Pipeline
    # ─────────────────────────────────────────────────────────────────────
    
    async def execute_task(
        self,
        task_type: str,
        task_data: Dict[str, Any],
        target_node: Optional[str] = None,
        require_ai_decision: bool = False
    ) -> Dict[str, Any]:
        """
        Execute task across cluster
        
        Coordinates:
        1. AI routing decision (if enabled)
        2. Task to appropriate node via gRPC
        3. Auth token validation
        4. Metrics recording
        5. Event publishing
        """
        task_id = str(uuid.uuid4())
        
        # Publish task created event
        await self.event_bus.publish(Event(
            event_id=str(uuid.uuid4()),
            event_type=EventType.TASK_CREATED,
            source_node="Orchestrator",
            timestamp=datetime.now(),
            data={
                "task_id": task_id,
                "task_type": task_type,
                "target_node": target_node,
                "require_ai_decision": require_ai_decision
            }
        ))
        
        try:
            # TODO: Implement task execution pipeline
            # 1. Check auth token validity
            # 2. Select node (AI routing or explicit target)
            # 3. Send via gRPC
            # 4. Monitor progress
            # 5. Record metrics
            
            result = {
                "task_id": task_id,
                "status": "completed",
                "result": {}
            }
            
            # Publish completion event
            await self.event_bus.publish(Event(
                event_id=str(uuid.uuid4()),
                event_type=EventType.TASK_COMPLETED,
                source_node="Orchestrator",
                timestamp=datetime.now(),
                data={"task_id": task_id, "result": result}
            ))
            
            return result
            
        except Exception as e:
            self.logger.error(f"❌ Task {task_id} failed: {e}")
            
            await self.event_bus.publish(Event(
                event_id=str(uuid.uuid4()),
                event_type=EventType.TASK_FAILED,
                source_node="Orchestrator",
                timestamp=datetime.now(),
                data={"task_id": task_id, "error": str(e)}
            ))
            
            raise
    
    # ─────────────────────────────────────────────────────────────────────
    # Health Monitoring
    # ─────────────────────────────────────────────────────────────────────
    
    async def _health_monitor_loop(self) -> None:
        """Continuously monitor cluster health"""
        while self.is_running:
            try:
                for node in self.node_registry.get_nodes():
                    # TODO: Check node health via gRPC
                    # is_healthy = await self.grpc_bridge.health_check(node)
                    # await self.node_registry.update_health(node.node_id, is_healthy)
                    pass
                
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                self.logger.error(f"Health monitor error: {e}")
                await asyncio.sleep(5)
    
    # ─────────────────────────────────────────────────────────────────────
    # Metrics & Status
    # ─────────────────────────────────────────────────────────────────────
    
    def get_cluster_status(self) -> Dict[str, Any]:
        """Get comprehensive cluster status"""
        uptime = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        
        return {
            "cluster": self.cluster_name,
            "running": self.is_running,
            "uptime_seconds": uptime,
            "timestamp": datetime.now().isoformat(),
            "nodes": [
                {
                    "id": n.node_id,
                    "name": n.node_name,
                    "address": n.address,
                    "healthy": n.is_healthy,
                    "capabilities": n.capabilities,
                    "last_heartbeat": n.last_heartbeat.isoformat() if n.last_heartbeat else None
                }
                for n in self.node_registry.get_nodes()
            ],
            "event_log_size": len(self.event_bus.event_log)
        }
    
    def get_recent_events(self, limit: int = 50) -> List[Dict]:
        """Get recent cluster events"""
        return self.event_bus.get_event_log(limit=limit)
    
    # ─────────────────────────────────────────────────────────────────────
    # Event Subscription Helpers
    # ─────────────────────────────────────────────────────────────────────
    
    def on_task_completed(self, callback: Callable) -> None:
        """Subscribe to task completion events"""
        self.event_bus.subscribe(EventType.TASK_COMPLETED, callback)
    
    def on_file_synced(self, callback: Callable) -> None:
        """Subscribe to file sync events"""
        self.event_bus.subscribe(EventType.FILE_SYNCED, callback)
    
    def on_node_joined(self, callback: Callable) -> None:
        """Subscribe to node join events"""
        self.event_bus.subscribe(EventType.NODE_JOINED, callback)

# ═══════════════════════════════════════════════════════════════════════════
# EXAMPLE USAGE
# ═══════════════════════════════════════════════════════════════════════════

async def main():
    logging.basicConfig(level=logging.INFO)
    
    # Create orchestrator
    orchestrator = NOIZYLABMasterOrchestrator("NOIZYLAB")
    
    # Register nodes
    m2_info = NodeInfo(
        node_id="m2-001",
        node_name="M2-Ultra",
        address="192.168.1.20",
        port=50051,
        os="macOS",
        role="primary",
        capabilities=["grpc", "ai_routing", "file_sync", "display"]
    )
    
    hp_info = NodeInfo(
        node_id="hp-001",
        node_name="HP-OMEN",
        address="192.168.1.40",
        port=50051,
        os="Windows",
        role="compute",
        capabilities=["grpc", "gpu", "file_sync"]
    )
    
    await orchestrator.node_registry.register(m2_info)
    await orchestrator.node_registry.register(hp_info)
    
    # Start orchestrator
    await orchestrator.start()
    
    # Execute a task
    print("\n📋 Executing test task...")
    result = await orchestrator.execute_task(
        task_type="inference",
        task_data={"model": "claude-3-opus", "prompt": "Hello"},
        require_ai_decision=True
    )
    print(f"Result: {result}")
    
    # Get status
    print("\n📊 Cluster Status:")
    status = orchestrator.get_cluster_status()
    print(json.dumps(status, indent=2))
    
    # Get recent events
    print("\n📅 Recent Events:")
    events = orchestrator.get_recent_events(limit=5)
    for event in events:
        print(f"  {event['timestamp']}: {event['type']} ({event['source']})")
    
    # Stop
    await orchestrator.stop()

if __name__ == "__main__":
    asyncio.run(main())
