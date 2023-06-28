import { Component, ViewChild } from '@angular/core';
import { DxDiagramComponent } from 'devextreme-angular';
import ArrayStore from 'devextreme/data/array_store';
import DataSource from 'devextreme/data/data_source';
import Guid from 'devextreme/core/guid';
import { BreakPointEnum, CopyNodeDto, DiagramToMenuTransferDto, EProcessStepTemplateType, EdgeDataDto, EnumContainerType, FlowEdge, FlowNode, INodeEdgeOperation, NodeDataDto, PipelineStepOption, ToolboxCategory } from './models/model';
import { PdsDiagramHelper } from './models/diagram-helper';
import { classToClass } from 'class-transformer';
import { HttpClient } from '@angular/common/http';
import { take } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  @ViewChild(DxDiagramComponent) diagram?: DxDiagramComponent;

  nodeDataSource?: DataSource;
  edgeDataSource?: DataSource;
  toolboxCategoryList: ToolboxCategory[] = [];
  
  nodeData: NodeDataDto[] = [];
  edgeData: FlowEdge[] = [];
  removingNode?: FlowNode;
  newShapeParentId?: string;
  selectedItem?: NodeDataDto;
  nodeList: NodeDataDto[] = [];
  connectionPoints: any;
  isNotAllowedToAdd: boolean = false;
  isCopiedSelectedItem: boolean = false;
  oldContainerKey?: string;
  isMoving: boolean = false;
  lastMoveNodeTime?: Date;
  previousSelectedItem?: NodeDataDto;
  intersectPosition?: { left: boolean; above: boolean; };
  previousOperation?: string;
  isTextChanged: boolean = false;
  isIntersectedDropHere: boolean = false;
  templateList?: any;
  breakPointEnum = BreakPointEnum;

  constructor(private http: HttpClient) {    
    this.initializeConnectionPointForCustomNodes();
  }

  url: string = '/assets/process.json';

  ngOnInit(): void {
    const data = this.getData().pipe(take(1)).toPromise()
    .then((data: any) => {
      this.templateList = data;
      console.log(this.templateList);
    })
    setTimeout(() => {this.getTemplateList()}, 500);
    
  }

  getData() {
    return this.http.get('/assets/process.json');
  }

  protected assignNodeDataSource() {
    this.nodeDataSource = new DataSource({
      store: new ArrayStore({
        key: 'id',
        data: this.nodeData,
        onInserting: (values: NodeDataDto) => {
          this.onNodeInserting(values);
        },
        onInserted: (values: NodeDataDto, key: string) => {
          PdsDiagramHelper.onNodeScrolling(key, this.diagram, this.nodeData.length);
        },
        onRemoving: (key) => {
          this.onNodeRemoving(key);
        }
      }),
      pushAggregationTimeout: 500,
      reshapeOnPush: true
    });
  }

  protected assignEdgeDataSource() {
    this.edgeDataSource = new DataSource({
      store: new ArrayStore({
        key: 'id',
        data: this.edgeData
      }),
      pushAggregationTimeout: 500,
      reshapeOnPush: true
    });
  }
  

  getTemplateList(){
    this.nodeList = PdsDiagramHelper.getDxDiagramNodeList(this.templateList);
    this.assignNodeDataSource();
    this.assignEdgeDataSource();
    PdsDiagramHelper.setInitialStartNode(this.nodeData);
  }


  

  

  onNodeInserting(values: NodeDataDto) {
    if (values) {
      let nodeDataSourceToBeUpdated: INodeEdgeOperation[] = [];
      let edgeDataSourceToBeUpdated: INodeEdgeOperation[] = [];

      PdsDiagramHelper.setNodeValues(values,this.nodeList,);
      this.setParentOfValues(values);
      this.setContainerNodeRelatedData(values, nodeDataSourceToBeUpdated);

      let containerData: NodeDataDto[] = PdsDiagramHelper.fillChildrenOfValues(values, nodeDataSourceToBeUpdated, edgeDataSourceToBeUpdated, this.nodeList);
      PdsDiagramHelper.shiftExistingParent(values, containerData, edgeDataSourceToBeUpdated, this.nodeData, this.edgeData, this.isIntersectedDropHere, this.intersectPosition);
      PdsDiagramHelper.updateNodeParentAndAddEdge(values, edgeDataSourceToBeUpdated, nodeDataSourceToBeUpdated, containerData, this.nodeData, this.edgeData);

      nodeDataSourceToBeUpdated.push({
        type: "insert",
        data: values
      });

      this.intersectPosition = undefined;
      this.isIntersectedDropHere = false;
      this.newShapeParentId = undefined;

      this.edgeDataSource?.store().push(edgeDataSourceToBeUpdated);
      this.nodeDataSource?.store().push(nodeDataSourceToBeUpdated);
    } else {
      // do nothing
    }
  }

  fillChildrenOfValues(
    values: NodeDataDto,
    nodeDataSourceToBeUpdated: INodeEdgeOperation[],
    edgeDataSourceToBeUpdated: INodeEdgeOperation[]
  ): NodeDataDto[] {
    console.log(values);
    let containerData: NodeDataDto[] = [];
    if (values && values.type === "cs-decision") {
      containerData = this.setChildrenNodeRelatedData(
        values,
        nodeDataSourceToBeUpdated,
        edgeDataSourceToBeUpdated
      );
    }
    return containerData;
  }

  setContainerNodeRelatedData(
    values: NodeDataDto,
    nodeDataSourceToBeUpdated: INodeEdgeOperation[]
  ) {
    if (values.isContainer) {
      values.type = 'verticalContainer';
      switch (values.nodeType) {
        case EProcessStepTemplateType.Exception:
        case EProcessStepTemplateType.Split:
          values.containerType = EnumContainerType.MainContainerWithChild;
          break;
        case EProcessStepTemplateType.PipelineStepGroup:
          values.containerType = EnumContainerType.MainContainer;

          nodeDataSourceToBeUpdated.push({
            type: "insert",
            data: PdsDiagramHelper.getDropHereNode(values)
          });
          break;
        default:
          values.containerType = EnumContainerType.MainContainer;
          break;
      }
    }

    if (values.parentId) {
      let parentNode = this.nodeData.find(e => e.id === values.parentId);
      if (parentNode) {
        values.groupId = parentNode.groupId;
        values.containerKey = parentNode.containerKey;
        if (parentNode.type === 'cs-drop-here') {
          this.isIntersectedDropHere = true;
          values.parentId = parentNode.parentId;
          nodeDataSourceToBeUpdated.push({ type: "remove", key: parentNode.id });
        }
      }
    }
  }

  setChildrenNodeRelatedData(
    values: NodeDataDto,
    nodeDataSourceToBeUpdated: INodeEdgeOperation[],
    edgeDataSourceToBeUpdated: INodeEdgeOperation[]
  ): NodeDataDto[] {
    let nodeContainerData: NodeDataDto[] = [];

    //#region If container
    // create If container
    let ifNode = new NodeDataDto();
    ifNode.id = new Guid().toString();
    ifNode.name = "If";
    ifNode.type = "verticalContainer";
    ifNode.groupId = values.id;
    ifNode.parentId = values.id;
    ifNode.containerKey = values.containerKey;
    nodeDataSourceToBeUpdated.push({ type: "insert", data: ifNode });
    nodeContainerData.push(ifNode);

    // add drop here node in if container
    let dropHereIfNode = new NodeDataDto();
    dropHereIfNode.id = new Guid().toString();
    dropHereIfNode.name = "Drop Here";
    dropHereIfNode.type = `text`;
    dropHereIfNode.groupId = ifNode.id;
    dropHereIfNode.containerKey = ifNode.id;
    nodeDataSourceToBeUpdated.push({ type: "insert", data: dropHereIfNode });

    // create If container edge with decision
    let ifEdge = new EdgeDataDto();
    ifEdge.id = new Guid().toString();
    ifEdge.fromId = values.id;
    ifEdge.toId = ifNode.id;
    edgeDataSourceToBeUpdated.push({ type: "insert", data: ifEdge });
    //#endregion

    //#region Else container
    // create Else container
    let elseNode = new NodeDataDto();
    elseNode.id = new Guid().toString();
    elseNode.name = "Else";
    elseNode.type = "verticalContainer";
    elseNode.groupId = values.id;
    elseNode.parentId = values.id;
    elseNode.containerKey = values.containerKey;
    nodeDataSourceToBeUpdated.push({ type: "insert", data: elseNode });
    nodeContainerData.push(elseNode);

    // add drop here node in else container
    let dropHereElseNode = new FlowNode();
    dropHereElseNode.id = new Guid().toString();
    dropHereElseNode.name = "Drop Here";
    dropHereElseNode.type = `text`;
    dropHereElseNode.groupId = elseNode.id;
    dropHereElseNode.containerKey = elseNode.id;
    nodeDataSourceToBeUpdated.push({ type: "insert", data: dropHereElseNode });

    // create Else container edge with decision
    let elseEdge = new FlowEdge();
    elseEdge.id = new Guid().toString();
    elseEdge.fromId = values.id;
    elseEdge.toId = elseNode.id;
    edgeDataSourceToBeUpdated.push({ type: "insert", data: elseEdge });
    //#endregion
    return nodeContainerData;
  }

  

  setParentOfValues(values: FlowNode) {
    if (this.newShapeParentId) {
      values.parentId = this.newShapeParentId;
      this.newShapeParentId = undefined;
    }
  }

  updateNodeParentAndAddEdge(
    values: FlowNode,
    edgeDataSourceToBeUpdated: INodeEdgeOperation[],
    containerData: FlowNode[]
  ) {
    // find parentNode
    let parentNode = this.nodeData.find((e) => e.id === values.parentId);
    if (parentNode) {
      // find sibling
      let siblingNeedToBeShifted: FlowNode | undefined;
      if (parentNode.type === "cs-decision") {
        siblingNeedToBeShifted = this.nodeData.find(
          (e) =>
            e.parentId === values.parentId && e.type !== "verticalContainer"
        );
      } else {
        siblingNeedToBeShifted = this.nodeData.find(
          (e) => e.parentId === values.parentId
        );
      }
      // if has sibling shift it after new inserted node and add edges
      if (siblingNeedToBeShifted) {
        this.updateSiblingRemoveOldEdges(
          siblingNeedToBeShifted,
          values,
          edgeDataSourceToBeUpdated
        );

        // insert edge of sibling node
        let newInsertedChildContainers: FlowNode[] = [];
        if (values.type === "cs-decision") {
          newInsertedChildContainers = containerData.filter(
            (e) => e.type === "verticalContainer"
          );
        } else {
          newInsertedChildContainers = [values];
        }
        this.addParentChildEdge(
          newInsertedChildContainers,
          siblingNeedToBeShifted,
          edgeDataSourceToBeUpdated
        );
      }

      // finally insert edge of new inserted node
      if (parentNode.type === "cs-decision") {
        let childContainersOfParent = this.nodeData.filter(
          (e) => e.parentId === parentNode?.id && e.type === "verticalContainer"
        );
        this.addParentChildEdge(
          childContainersOfParent,
          values,
          edgeDataSourceToBeUpdated
        );
      } else {
        //debugger
        this.addParentChildEdge(
          [parentNode],
          values,
          edgeDataSourceToBeUpdated
        );
      }
    } else {
      // do nothing
    }
  }

  updateSiblingRemoveOldEdges(
    siblingNeedToBeShifted: FlowNode,
    values: FlowNode,
    edgeDataSourceToBeUpdated: INodeEdgeOperation[]
  ) {
    siblingNeedToBeShifted.parentId = values.id;
    let connectedEdges = this.edgeData.filter(
      (e) => e.toId === siblingNeedToBeShifted?.id
    );
    if (connectedEdges) {
      // remove existing edge and add new edge with new inserting node
      for (let index = 0; index < connectedEdges.length; index++) {
        const element = connectedEdges[index];
        edgeDataSourceToBeUpdated.push({ type: "remove", key: element.id });
      }
    }
  }

  addParentChildEdge(
    fromData: FlowNode[],
    toData: FlowNode,
    edgeDataSourceToBeUpdated: INodeEdgeOperation[]
  ) {
    for (let index = 0; index < fromData.length; index++) {
      const element = fromData[index];
      edgeDataSourceToBeUpdated.push({
        type: "insert",
        data: {
          fromId: element.id,
          text: "",
          toId: toData.id
        }
      });
    }
  }

  onNodeRemoving(key: string) {
    this.removingNode = this.nodeData.find((e) => e.id === key);
    if (this.removingNode?.id) {
      this.onRemoving(this.removingNode.id);
    }
  }

  onRemoving(key: string) {
    let nodeDataSourceToBeUpdated: INodeEdgeOperation[] = [];
    let edgeDataSourceToBeUpdated: INodeEdgeOperation[] = [];

    let removingNodeData = this.nodeData.find((e) => e.id === key);
    if (removingNodeData) {
      this.onRemovingStarts(key, nodeDataSourceToBeUpdated);
      this.checkForAddingDropHere(nodeDataSourceToBeUpdated);

      // update connected children with edge
      //check removing node is decision or not and get child
      let existingChildNodeToBeShifted: FlowNode | undefined;
      if (removingNodeData.type === "cs-decision") {
        existingChildNodeToBeShifted = this.nodeData.find(
          (e) =>
            e.parentId === removingNodeData?.id &&
            e.type !== "verticalContainer"
        );
      } else {
        existingChildNodeToBeShifted = this.nodeData.find(
          (e) => e.parentId === removingNodeData?.id
        );
      }

      if (existingChildNodeToBeShifted) {
        existingChildNodeToBeShifted.parentId = removingNodeData?.parentId;
        let parentNode = this.nodeData?.find(
          (e) => e.id === existingChildNodeToBeShifted?.parentId
        );
        if (parentNode) {
          let childContainers: FlowNode[] = [];
          if (parentNode.type === "cs-decision") {
            childContainers = this.nodeData.filter(
              (e) =>
                e.parentId === parentNode?.id && e.type === "verticalContainer"
            );
          } else {
            childContainers = [parentNode];
          }
          this.addParentChildEdge(
            childContainers,
            existingChildNodeToBeShifted,
            edgeDataSourceToBeUpdated
          );
        }
      }

      this.edgeDataSource?.store().push(edgeDataSourceToBeUpdated);
      this.nodeDataSource?.store().push(nodeDataSourceToBeUpdated);
    }
  }

  onRemovingStarts(
    key: string,
    nodeDataSourceToBeUpdated: INodeEdgeOperation[]
  ) {
    let removingNodeData = this.nodeData.find((e) => e.id === key);
    if (removingNodeData) {
      this.removeComplexNode(removingNodeData, nodeDataSourceToBeUpdated);
      nodeDataSourceToBeUpdated.push({
        type: "remove",
        key: removingNodeData.id
      });
    }
  }

  removeComplexNode(
    removingNodeData: FlowNode,
    nodeDataSourceToBeUpdated: INodeEdgeOperation[]
  ) {
    let groupedChildren = this.nodeData.filter(
      (e) => e.groupId === removingNodeData.id
    );
    for (let index = 0; index < groupedChildren.length; index++) {
      const element = groupedChildren[index];
      if (element.type === "verticalContainer") {
        if (element.id) {
          this.onRemovingStarts(element.id, nodeDataSourceToBeUpdated);
        }
      } else {
        nodeDataSourceToBeUpdated.push({
          type: "remove",
          key: element.id
        });
      }
    }
  }

  checkForAddingDropHere(nodeDataSourceToBeUpdated: INodeEdgeOperation[]) {
    let containerData = this.nodeData.find(
      (e) => e.id === this.removingNode?.containerKey
    );
    if (containerData) {
      let nodesInContainer = this.nodeData.filter(
        (e) => e.containerKey === containerData?.id
      );
      let isContainerNodeEmpty: boolean = true;
      if (nodesInContainer.length) {
        for (let index = 0; index < nodesInContainer.length; index++) {
          const element = nodesInContainer[index];
          let findNodeAsRemoved = nodeDataSourceToBeUpdated.find(
            (e) => e.type === "remove" && e.key === element.id
          );
          if (!findNodeAsRemoved) {
            isContainerNodeEmpty = false;
            break;
          }
        }
      }
      if (isContainerNodeEmpty) {
        let node = new FlowNode();
        node.id = new Guid().toString();
        node.name = "Drop Here";
        node.type = `text`;
        node.groupId = containerData.id;
        node.containerKey = containerData.id;
        nodeDataSourceToBeUpdated.push({ type: "insert", data: node });
      }
    }
    this.removingNode = undefined;
  }

  requestEditOperationHandler(e: any) {
    if (this.isNotAllowedToAdd) {
      e.allowed = false;
      this.isNotAllowedToAdd = false;
      return;
    }

    if (e.operation === "moveShape") {
      if (e.args.shape.key !== this.selectedItem?.id) {
        e.allowed = false;
        // this.diagramInstanceReload(true); 
        return;
      }

      if (e.args.shape.dataItem.originalType === 'cs-start-process' ||
        e.args.shape.dataItem.originalType === 'cs-drop-here' ||
        e.args.shape.dataItem.originalType === 'cs-text') {
        e.allowed = false;
        // this.diagramInstanceReload(true); 
        return;
      }

      if (e.args.shape.dataItem.containerType === EnumContainerType.ContainerChild) {
        e.allowed = false;
        // this.diagramInstanceReload(true); 
        return;
      }

      if (!this.isCopiedSelectedItem) {
        let dataItem = classToClass<NodeDataDto>(e.args.shape.dataItem);
        this.oldContainerKey = dataItem?.containerKey;
        this.isCopiedSelectedItem = true;
      }

      // Filtered list of shapes (not containing edges(connectors) and text nodes) 
      let shapes = e.component.getItems().filter((x: any) => x.itemType == "shape" && x.dataItem?.type !== "cs-text");
      if (e.args.shape.dataItem.containerType === EnumContainerType.MainContainer ||
        e.args.shape.dataItem.containerType === EnumContainerType.MainContainerWithChild) {
        let groupedShapes = PdsDiagramHelper.gettingGroupedItemStarts(this.nodeData, e.args.shape.dataItem, []);
        for (let index = 0; index < groupedShapes.length; index++) {
          const element = groupedShapes[index];
          let shapeFindIndex = shapes.findIndex((j: any) => j.key === element.id);
          if (shapeFindIndex > -1) {
            shapes.splice(shapeFindIndex, 1);
          }
        }
      }

      this.isMoving = true;

      this.lastMoveNodeTime = new Date();
      let setDataTimer = setInterval(() => {

        if (this.lastMoveNodeTime) {
          let diff = new Date().getTime() - this.lastMoveNodeTime?.getTime();
          if (diff >= 1000) {
            this.isMoving = false;
            this.onNodeMoving();
            clearInterval(setDataTimer);
          }
          else {
            if (setDataTimer) {
              clearInterval(setDataTimer);
              this.isMoving = false;
              // let isNodeIntersecting = this.checkIsNodeIntersectForMove(shapes, e);
              // if (!isNodeIntersecting) {
              //   this.diagramInstanceReload(); 
              // }
            }
          }
        }
        else {
          if (setDataTimer) {
            clearInterval(setDataTimer);
            this.isMoving = false;
            // let isNodeIntersecting = this.checkIsNodeIntersectForMove(shapes, e);
            // if (!isNodeIntersecting) {
            //   this.diagramInstanceReload();
            // }
          }
        }
      }, 1000);

      e.allowed = false;
      this.newShapeParentId = undefined;
      this.intersectPosition = undefined;
      this.checkIntersectForMove(shapes, shapes, e);
      if (this.selectedItem) {
        this.previousSelectedItem = classToClass<NodeDataDto>(this.selectedItem);
      }
      else {
        this.previousSelectedItem = undefined;
      }
    }
    else {
      if (this.isMoving) {
        this.isMoving = false;
        this.onNodeMoving();
      }
      this.previousOperation = e.operation;
    }


    //'beforeChangeShapeText' operation calls before text of the node changes from UI
    // 1. Restricts the text change of the following nodes 
    // 2. Decision branches container and Text nodes 
    // 3. Exception's Try, Catch and Finally  nodes (PipelineStepGroup)
    // 4. Split's Steps node (PipelineStepGroup)

    if (e.operation === "beforeChangeShapeText") {
      // if ((e?.args?.shape?.dataItem?.nodeType === EProcessStepTemplateType.Decision ||
      //   e?.args?.shape?.dataItem?.nodeType === EProcessStepTemplateType.Exception ||
      //   e?.args?.shape?.dataItem?.nodeType === EProcessStepTemplateType.PipelineStepGroup) &&
      //   (e?.args?.shape?.dataItem?.containerType === EnumContainerType.ContainerChild) &&
      //   (e?.args?.shape?.dataItem?.originalType !== 'cs-text')) {
      //   e.allowed = false;
      // }
      e.allowed = false;
      this.isTextChanged = true;
    }

    if (e.operation === "changeShapeText") {
      if (this.isTextChanged) {
        this.isTextChanged = false;
        //this.validateAndSave();
      }
    }

    // Restricts default delete operation from delete key because  we need to restrict delete  for some nodes such as branches of Decision
    // We have  to do handle this from Key bind event
    if (e.operation === 'deleteShape') {
      e.allowed = false;
    }

    // 'addShape' operation called when you drag the node  from the toolbox
    else if (e.operation === "addShape") {
      // Filtered list of shapes (not containing edges(connectors) and text nodes) 
      let shapes = e.component.getItems().filter((x: any) => x.itemType == "shape" && x.dataItem?.type !== "cs-text");
      //console.log(shapes)
      e.allowed = false;
      this.intersectPosition = undefined;
      const sequencedShapes = PdsDiagramHelper.getSequencedShapes(shapes);
      console.log(sequencedShapes);
      this.checkIntersect(sequencedShapes, e);
      // let shapes = e.component
      //   .getItems()
      //   .filter((x: any) => x.itemType === "shape");
      // // e.allowed = false;
      // this.checkIntersect(shapes, e);
    }
    else {
      // do  nothing
    }
  }

  checkIntersectForMove(allShapes: any, shapes: any, e: any) {
    this.newShapeParentId = undefined;
    for (let i = 0; i < shapes.length; i += 1) {
      let shape = shapes[i];
      if (shape.key != e.args.shape.key) {
        let minAx = e.args.shape.position.x;
        let minAy = e.args.shape.position.y;
        let maxAx = e.args.shape.position.x + e.args.shape.size.width;
        let maxAy = e.args.shape.position.y + e.args.shape.size.height;
        let minBx = shape.position.x;
        let minBy = shape.position.y;
        let maxBx = shape.position.x + shape.size.width;
        let maxBy = shape.position.y + shape.size.height;

        // If dragged node is intersects with the shape(node) of the diagram 
        if (PdsDiagramHelper.doRectanglesIntersect(minAx, minAy, maxAx, maxAy, minBx, minBy, maxBx, maxBy)) {
          this.intersectPosition = PdsDiagramHelper.getIntersectPosition(minAx, minAy, maxAx, maxAy, minBx, minBy, maxBx, maxBy);
          e.allowed = true;

          // If intersected node(shape) is basic simple node (not container node)
          if (shape.type !== 'verticalContainer') {

            // Checks if simple intersected node(shape) is split xpath, split code, join type code. null or wrapper.
            // if it is true then dragged node can't be added below the intersected  node.
            if (shape.dataItem.containerType) {
              e.allowed = false;
              // this.newShapeParentId = undefined;
              // return;
            }
            else {
              if (this.intersectPosition?.above) {
                // if (shape.dataItem.id === e.args.shape.dataItem.parentId
                //   || shape.dataItem.parentId === e.args.shape.dataItem.id) {
                if (shape.dataItem.parentId === e.args.shape.dataItem.id
                  || (shape.dataItem.id === e.args.shape.dataItem.parentId && shape.dataItem.type === 'cs-start-process')) {
                  e.allowed = false;
                  this.newShapeParentId = undefined;
                  return;
                }
              }
              else {
                if (shape.dataItem.id === e.args.shape.dataItem.parentId) {
                  e.allowed = false;
                  this.newShapeParentId = undefined;
                  return;
                }
              }
              e.allowed = true;
              this.newShapeParentId = shape.key;
            }
            return;
          }
          else {
            // If intersected node(shape) is container node, we  need to  check the intersections for all children with in the container 
            e.allowed = true;

            if ((e.args.shape.dataItem.nodeType === EProcessStepTemplateType.Decision ||
              e.args.shape.dataItem.nodeType === EProcessStepTemplateType.Parallel ||
              e.args.shape.dataItem.nodeType === EProcessStepTemplateType.SchemaValidation)
              && !e.args.shape.dataItem.containerType) {
              let childContainers = this.nodeData.filter(y => y.parentId === e.args.shape.dataItem.id && PdsDiagramHelper.isAllChildOfSpecialNodeType(y));
              let isCurrentShapeChild = childContainers.find(child => child.id === shape.dataItem.id);
              if (isCurrentShapeChild) {
                e.allowed = false;
                return;
              }
            }

            let containerShapes = allShapes.filter((s: any) => s.dataItem.containerKey == shape.dataItem.id);
            this.checkIntersectForMove(allShapes, containerShapes, e);

            // Restricts creation of child node beneath Try Catch Finally, split step join node etc. 
            if (shape.dataItem.containerType === EnumContainerType.ContainerChild) {
              e.allowed = false;
            }
            else {
              if (!this.newShapeParentId) {
                if (this.intersectPosition?.above) {
                  // if (shape.dataItem.id === e.args.shape.dataItem.parentId
                  //   || shape.dataItem.parentId === e.args.shape.dataItem.id) {
                  if (shape.dataItem.parentId === e.args.shape.dataItem.id
                    || (shape.dataItem.id === e.args.shape.dataItem.parentId && shape.dataItem.type === 'cs-start-process')) {
                    e.allowed = false;
                    this.newShapeParentId = undefined;
                    return;
                  }
                }
                else {
                  if (shape.dataItem.id === e.args.shape.dataItem.parentId) {
                    e.allowed = false;
                    this.newShapeParentId = undefined;
                    return;
                  }
                }
                this.newShapeParentId = shape.key;
              }
            }
          }
        } else {
          // do  nothing
        }
      }
    }
  }

  onNodeMoving() {
    if (this.newShapeParentId) {
      let copyingNode: CopyNodeDto | undefined;
      copyingNode = this.copyNode(this.previousSelectedItem, true);
      if (this.intersectPosition?.above) {
        let parentNode = this.nodeData.find(e => e.id === this.newShapeParentId);
        if (parentNode) {
          if (parentNode.type === 'cs-start-process' || parentNode.type === 'cs-drop-here') {
            this.pasteNode(copyingNode, parentNode);
          }
          else {
            let isParentOfParentExist = this.nodeData.find(e => e.id === parentNode?.parentId);
            if (isParentOfParentExist) {
              this.pasteNode(copyingNode, isParentOfParentExist);
            }
            else {
              this.pasteNodeWithoutParent(copyingNode, parentNode);
            }
          }
        }
        else {
          // do nothing
        }
      }
      else {
        let parentNode = this.nodeData.find(e => e.id === this.newShapeParentId);
        this.pasteNode(copyingNode, parentNode);
      }

      this.newShapeParentId = undefined;
      this.previousSelectedItem = undefined;
      this.intersectPosition = undefined;
      this.oldContainerKey = undefined;
      this.isMoving = false;
      this.isCopiedSelectedItem = false;
    }
    else {
      this.newShapeParentId = undefined;
      this.previousSelectedItem = undefined;
      this.intersectPosition = undefined;
      this.oldContainerKey = undefined;
      this.isMoving = false;
      this.isCopiedSelectedItem = false;
    }
  }

  pasteNodeWithoutParent(needToBePastedNode: CopyNodeDto | undefined, pasteBeforeNode: NodeDataDto | undefined) {
    
  }

  copyNode(needToBeCopied: NodeDataDto | undefined, calledFromCut: boolean = false): CopyNodeDto | undefined {
    let copyingNode: CopyNodeDto | undefined = undefined;
    if (needToBeCopied) {
      copyingNode = new CopyNodeDto();
      copyingNode.nodeType = needToBeCopied.nodeType;
      //copyingNode.node = classToClass<NodeDataDto>(needToBeCopied);
      copyingNode.children = [];
      copyingNode.childrenInsideContainer = [];

      if (needToBeCopied.nodeType === EProcessStepTemplateType.Base
        || needToBeCopied.nodeType === EProcessStepTemplateType.Code) {
        // base node has no children
        copyingNode.children = [];
        copyingNode.childrenInsideContainer = [];
      }
      else if (needToBeCopied.nodeType === EProcessStepTemplateType.PipelineStepGroup) {
        // for, forEach have children
        //copyingNode.childrenInsideContainer = PdsDiagramHelper.gettingGroupedItemStarts(this.nodeData, copyingNode.node, []);
      }
      else {
        // exception, decision, split, schema validation and parallel have children and inside each child there can be children
        copyingNode.children = PdsDiagramHelper.getChildrenInsideChildren(this.nodeData, needToBeCopied);
      }
      if (calledFromCut) {
        if (needToBeCopied.id) {
          this.onNodeRemoving(needToBeCopied.id);
        }
      }
    }
    return copyingNode;
  }

  pasteNode(needToBePastedNode: CopyNodeDto | undefined, pasteAfterNode: NodeDataDto | undefined) {
    if (needToBePastedNode?.node && pasteAfterNode) {
      let nodeDataSourceToBeUpdated: INodeEdgeOperation[] = [];
      let edgeDataSourceToBeUpdated: INodeEdgeOperation[] = [];

      // find sibling
      let siblingNeedToBeShifted: NodeDataDto | undefined;
      if (PdsDiagramHelper.isSpecialNodeTypeWithBranches(pasteAfterNode)) {
        siblingNeedToBeShifted = this.nodeData.find(e => e.parentId === pasteAfterNode?.id && !PdsDiagramHelper.isAllChildOfSpecialNodeType(e));
      }
      else {
        siblingNeedToBeShifted = this.nodeData.find(e => e.parentId === pasteAfterNode?.id);
      }
    }
  }

  checkIntersect(shapes: any, e: any) {
    this.newShapeParentId = undefined;
    for (let i = 0; i < shapes.length; i += 1) {
      let shape = shapes[i];
      if (shape.id !== e.args.shape.id) {
        let minAx = e.args.position.x;
        let minAy = e.args.position.y;
        let maxAx = e.args.position.x + e.args.shape.size.width;
        let maxAy = e.args.position.y + e.args.shape.size.height;
        let minBx = shape.position.x;
        let minBy = shape.position.y;
        let maxBx = shape.position.x + shape.size.width;
        let maxBy = shape.position.y + shape.size.height;

        if (
          this.doRectanglesIntersect(
            minAx,
            minAy,
            maxAx,
            maxAy,
            minBx,
            minBy,
            maxBx,
            maxBy
          )
        ) {
          e.allowed = true;
          if (shape.type !== "verticalContainer") {
            this.newShapeParentId = shape.key;
            return;
          } else {
            let containerShapes = shapes.filter(
              (e: any) => e.containerId === shape.id
            );
            this.checkIntersect(containerShapes, e);

            if (shape.dataItem.type === "verticalContainer") {
              e.allowed = false;
            } else {
              if (!this.newShapeParentId) {
                this.newShapeParentId = shape.key;
              }
            }
          }
        } else {
          // do  nothing
        }
      }
    }
  }

  requestLayoutUpdateHandler(e: any) {
    // console.log(e);
  }

  onInitialized(e: any) {
    let data = new DiagramToMenuTransferDto();
    data.diagramEvent = e;
    data.toolboxCategoryList = this.toolboxCategoryList;
    //data.calledFor = this.diagramCalledFor;
    //this.navService.loadDiagramToolbox.next(data);
    let d = e.component._diagramInstance;
    d.eventManager.mouseHandler.allowCopyDiagramItems = false;
    this.onDiagramInitSetContainerPadding(e);
  }

  //NOTE: set custom padding to containers  
  onDiagramInitSetContainerPadding(event?: any) {
    const instance = event.component._diagramInstance
    const createDocumentDataSourceNative = instance.createDocumentDataSource;
    instance.createDocumentDataSource = function () {
      const documentDataSource = createDocumentDataSourceNative.apply(instance, arguments);
      const createModelItemsNative = documentDataSource.createModelItems;
      documentDataSource.createModelItems = function () {
        arguments[4].layoutSettings.containerPadding = 200, 500, 300, 0;
        createModelItemsNative.apply(documentDataSource, arguments);
      }
      return documentDataSource;
    }
  }

  onSelectionChanged(e: any) {
    
  }

  getType(type: string) {
    switch (type) {
      case 'cs-c#':
        return 'cs-code';
      case 'cs-c#-class':
        return 'cs-csharp-class';
      default:
        return type;
    }
  }

  getOriginalNode(type: string): NodeDataDto | undefined {
    let node = this.nodeList?.find(e => e.originalType === type);
    return node;
  }

  initializeConnectionPointForCustomNodes() {
    this.connectionPoints = [
      { x: 0.485, y: 0 },
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
      { x: 0.485, y: 1 }
    ];
  }


  doRectanglesIntersect(
    minAx: number,
    minAy: number,
    maxAx: number,
    maxAy: number,
    minBx: number,
    minBy: number,
    maxBx: number,
    maxBy: number
  ) {
    let aLeftOfB = maxAx < minBx;
    let aRightOfB = minAx > maxBx;
    let aAboveB = minAy > maxBy;
    let aBelowB = maxAy < minBy;
    return !(aLeftOfB || aRightOfB || aAboveB || aBelowB);
  }
}


