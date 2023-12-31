class CreepBase {
  constructor(creep) {
    this.creep = creep;
  }
  moveTo(
    target,
    options = {
      visualizePathStyle: { stroke: "#ffffff" },
      reusePath: 1,
    }
  ) {
    this.creep.moveTo(target, options);
  }
  addRoadSites() {
    // if current position doesn't have a road, create construction site
    if (this.creep.room.lookForAt(LOOK_STRUCTURES, this.creep.pos.x, this.creep.pos.y).length == 0 && this.creep.room.lookForAt(LOOK_CONSTRUCTION_SITES, this.creep.pos.x, this.creep.pos.y).length == 0) {
      this.creep.room.createConstructionSite(this.creep.pos.x, this.creep.pos.y, STRUCTURE_ROAD);
    }
  }
  performUpgradeRole() {
    if (this.creep.upgradeController(this.creep.room.controller) == ERR_NOT_IN_RANGE) {
      // Move to it
      this.creep.moveTo(this.creep.room.controller);
      return true;
    } else {
      // check if there are screeps behind it
      this.moveOffRoad();
      return false;
    }
  }
  performRepairRole() {
    // Repairing logic
    let structuresToRepair = this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.hits < structure.hitsMax && structure.structureType != STRUCTURE_WALL,
    });
    // filter out ramparts if they are below 50k hits
    structuresToRepair = structuresToRepair.filter((structure) => structure.structureType != STRUCTURE_RAMPART || structure.hits > 50000);
    structuresToRepair.sort((a, b) => a.hits - b.hits); // Repair the most damaged first

    if (structuresToRepair.length > 0) {
      // Non road structures
      const nonRoadStructuresToRepair = structuresToRepair.filter((structure) => structure.structureType != STRUCTURE_ROAD);
      // Non road structures with less than half hits
      const nonRoadStructuresToRepairLessThanHalf = nonRoadStructuresToRepair.filter((structure) => structure.hits < structure.hitsMax / 2);
      if (nonRoadStructuresToRepairLessThanHalf.length > 0) {
        structuresToRepair = nonRoadStructuresToRepairLessThanHalf;
      }

      if (this.creep.repair(structuresToRepair[0]) === ERR_NOT_IN_RANGE) {
        this.creep.moveTo(structuresToRepair[0]);
      }
      return true;
    } else {
      // No structures to repair, so consider other tasks or stay idle
      // e.g., creep.moveTo(Game.flags["IdleFlag"]);
      return false;
    }
  }
  performBuildRole() {
    // find construction sites
    let targets = this.creep.room.find(FIND_CONSTRUCTION_SITES);
    // remove ramparts that have over 50k hits
    targets = targets.filter((target) => target.structureType !== STRUCTURE_RAMPART || target.hits < 50000);
    // get extensions
    const extensions = targets.filter((target) => target.structureType == STRUCTURE_EXTENSION);
    // sort extensions by proximity to creep and progress remaining
    extensions.sort((a, b) => this.creep.pos.getRangeTo(a) - this.creep.pos.getRangeTo(b) + (a.progressTotal - a.progress) - (b.progressTotal - b.progress));
    if (extensions.length > 0) {
      if (this.creep.build(extensions[0]) == ERR_NOT_IN_RANGE) {
        this.creep.moveTo(extensions[0]);
      }
      return true;
    }
    // sort targets by combination of proximity to creep and progress remaining
    targets.sort((a, b) => {
      return this.creep.pos.getRangeTo(a) - this.creep.pos.getRangeTo(b) + (a.progressTotal - a.progress) - (b.progressTotal - b.progress);
    });
    if (targets.length > 0) {
      if (this.creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
        this.creep.moveTo(targets[0]);
      }
      return true;
    } else {
      return false;
    }
  }
  collectFromContainers() {
    const containers = this.creep.room.find(FIND_STRUCTURES, {
      filter: (s) => (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE) && s.store[RESOURCE_ENERGY] > 0,
    });

    if (containers.length > 0) {
      const closestContainer = this.creep.pos.findClosestByPath(containers);
      if (this.creep.withdraw(closestContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.creep.moveTo(closestContainer);
        return true; // Exit early if we're moving to a container or storage
      }
    }
    return false;
  }
  collectFromStorage() {
    const storage = this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 0,
    });
    if (storage.length > 0) {
      const closestStorage = this.creep.pos.findClosestByPath(storage);
      if (this.creep.withdraw(closestStorage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.creep.moveTo(closestStorage);
        return true; // Exit early if we're moving to a container or storage
      }
    }
    return false;
  }
  collectEnergyFromGround(source) {
    let droppedEnergy = this.creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType == RESOURCE_ENERGY,
    });
    if (source) {
      droppedEnergy = droppedEnergy.filter((resource) => resource.pos.findInRange(FIND_SOURCES, 1, { filter: { id: source } }).length > 0);
    }
    if (droppedEnergy.length > 0) {
      let target;
      // if a "builder" or "repairer", only get dropped energy that is within 3 range of the spawn
      if (this.creep.memory.role == "builder" || this.creep.memory.role == "repairer" || this.creep.memory.role == "upgrader") {
        const spawn = this.creep.pos.findClosestByRange(FIND_MY_SPAWNS);
        droppedEnergy = droppedEnergy.filter((resource) => spawn.pos.getRangeTo(resource) < 3);
      }
      if (droppedEnergy.length > 0) {
        // closest energy first
        let closestEnergy = this.creep.pos.findClosestByRange(droppedEnergy);
        // if it is more than what the creep can carry
        if (closestEnergy.amount > this.creep.store.getFreeCapacity()) {
          target = closestEnergy;
        } else {
          // largest energy first
          droppedEnergy.sort((a, b) => b.amount - a.amount);
          target = droppedEnergy[0];
        }
        if (this.creep.pickup(target) == ERR_NOT_IN_RANGE) {
          this.creep.moveTo(target);
        }
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  depositToSpawn() {
    const spawns = this.creep.room.find(FIND_MY_SPAWNS, {
      filter: (spawn) => spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });
    if (spawns.length > 0) {
      // Find the closest spawn
      const closestSpawn = this.creep.pos.findClosestByRange(spawns);

      // Try to transfer energy to the spawn. If it's not in range
      if (this.creep.transfer(closestSpawn, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        // Move to it
        this.creep.moveTo(closestSpawn);
      }
      return true;
    } else {
      return false;
    }
  }
  depositToContainer() {
    const containers = this.creep.room.find(FIND_STRUCTURES, {
      filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    if (containers.length > 0) {
      const closestContainer = this.creep.pos.findClosestByPath(containers);
      if (this.creep.transfer(closestContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.creep.moveTo(closestContainer);
        return true; // Exit early if we're moving to a container or storage
      }
    } else {
      return false;
    }
  }
  depositToExtensions() {
    const extensions = this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });
    if (extensions.length > 0) {
      // Find the closest extension
      const closestExtension = this.creep.pos.findClosestByRange(extensions);

      // Try to transfer energy to the extension. If it's not in range
      if (this.creep.transfer(closestExtension, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        // Move to it
        this.creep.moveTo(closestExtension);
      }
      return true;
    } else {
      return false;
    }
  }
  depositToStorage() {
    const storage = this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });
    if (storage.length > 0) {
      // Find the closest storage
      const closestStorage = this.creep.pos.findClosestByRange(storage);

      // Try to transfer energy to the storage. If it's not in range
      if (this.creep.transfer(closestStorage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        // Move to it
        this.creep.moveTo(closestStorage);
      }
      return true;
    } else {
      return false;
    }
  }
  transferEnergyToExtensions() {
    // assist haulers by transferring energy from containers to extensions
    const extensions = this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });
    if (extensions.length > 0) {
      // if creep has energy at all, then transfer, otherwise collect
      if (this.creep.store.getUsedCapacity() > 0) {
        if (this.creep.transfer(extensions[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
          this.creep.moveTo(extensions[0]);
        }
      } else {
        const collectingFromContainers = this.collectFromContainers();
        if (collectingFromContainers) {
          return true;
        }
      }
      return true;
    } else {
      return false;
    }
  }
  transferEnergyToTowers() {
    // assist haulers by transferring energy from containers to towers
    let towers = this.creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType == STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 200,
    });
    if (towers.length > 0) {
      // if creep has capacity, collect from containers
      if (this.creep.store.getFreeCapacity() > 0) {
        const collectingFromContainers = this.collectFromContainers();
        if (collectingFromContainers) {
          return true;
        }
        const collectingFromGround = this.collectEnergyFromGround();
        if (collectingFromGround) {
          return true;
        }
      }
      // sort towers by energy level
      towers = towers.sort((a, b) => a.store.getFreeCapacity(RESOURCE_ENERGY) - b.store.getFreeCapacity(RESOURCE_ENERGY));
      if (this.creep.transfer(towers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        this.creep.moveTo(towers[0]);
        return true;
      }
    } else {
      return false;
    }
  }
  moveOffRoad() {
    // if current position is a road
    if (this.creep.room.lookForAt(LOOK_STRUCTURES, this.creep.pos.x, this.creep.pos.y).length > 0 && this.creep.room.lookForAt(LOOK_STRUCTURES, this.creep.pos.x, this.creep.pos.y)[0].structureType == STRUCTURE_ROAD) {
      return;
    }
    // method to have creep move to the nearest open tile that's not a road
    const creep = this.creep;
    const creepPos = creep.pos;
    const terrain = creep.room.getTerrain();
    const x = creepPos.x;
    const y = creepPos.y;
    const terrainAtPos = terrain.get(x, y);
    const terrainAtPosLeft = terrain.get(x - 1, y);
    const terrainAtPosRight = terrain.get(x + 1, y);
    const terrainAtPosTop = terrain.get(x, y - 1);
    const terrainAtPosBottom = terrain.get(x, y + 1);
    const terrainLeft = terrain.get(x - 1, y);
    const terrainRight = terrain.get(x + 1, y);
    const terrainTop = terrain.get(x, y - 1);
    const terrainBottom = terrain.get(x, y + 1);
    const terrainTopLeft = terrain.get(x - 1, y - 1);
    const terrainTopRight = terrain.get(x + 1, y - 1);
    const terrainBottomLeft = terrain.get(x - 1, y + 1);
    const terrainBottomRight = terrain.get(x + 1, y + 1);
    let terrainArray = [terrainAtPos, terrainAtPosLeft, terrainAtPosRight, terrainAtPosTop, terrainAtPosBottom, terrainLeft, terrainRight, terrainTop, terrainBottom, terrainTopLeft, terrainTopRight, terrainBottomLeft, terrainBottomRight];
    // remove any impassable terrain from array
    terrainArray = terrainArray.filter((t) => t !== TERRAIN_MASK_WALL);
    // remove any structures from array
    const structures = creep.room.lookForAt(LOOK_STRUCTURES, creepPos);
    if (structures.length > 0) {
      terrainArray = terrainArray.filter((t) => t !== structures[0].structureType);
    }
    // remove any creeps from array
    const creeps = creep.room.lookForAt(LOOK_CREEPS, creepPos);
    if (creeps.length > 0) {
      terrainArray = terrainArray.filter((t) => t !== LOOK_CREEPS);
    }
    // remove any terrain that is not plain
    terrainArray = terrainArray.filter((t) => t !== TERRAIN_MASK_SWAMP);
    this.creep.move(this.creep.pos.getDirectionTo(terrainArray[0]));
  }
}

export default CreepBase;
