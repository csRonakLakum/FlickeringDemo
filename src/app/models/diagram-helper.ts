import { DxDiagramComponent } from "devextreme-angular";
import { BranchModel, BreakPointEnum, ChildDataDto, ContextMenuDto, CopyNodeChildDto, DecisionStepModel, EProcessStepTemplateType, EdgeDataDto, EnumContainerType, EnumDiagramCalledFor, INodeEdgeOperation, NodeDataDto, PipelineStepOption } from "./model";
import Guid from "devextreme/core/guid";
import { classToClass, plainToClass } from 'class-transformer';

export enum EnumFindNodeTye {
    Self = 1,
    Basic = 2,
    Container = 3,
}
export class PdsDiagramHelper {

    // scroll to node with timeout
    public static onNodeScrolling(key?: string, diagram?: DxDiagramComponent, nodeLength?:number) {
        let timeOutTime = 500;
        if(nodeLength){
            if(nodeLength<=20){
                timeOutTime=500;
            }
            else if(nodeLength>20 && nodeLength<=40){
                timeOutTime=1000;
            }
            else if(nodeLength>40 && nodeLength<=60){
                timeOutTime=1500;
            }
            else if(nodeLength>60 && nodeLength<=100){
                timeOutTime=2000;
            }
            else{
                timeOutTime=2500;
            }
        }
        
        setTimeout(() => {
            this.scrollToNode(key, diagram);
        }, timeOutTime);
    }

    // scroll to node without timeout
    public static scrollToNode(key?: string, diagram?: DxDiagramComponent) {
        if (key) {
            let node = diagram?.instance?.getItemByKey(key);
            if (node) {
                diagram?.instance?.scrollToItem(node);
            }
        }
    }

    // scroll to parent/container after removing
    public static scrollToParentOfRemovingNode(parentOfRemovingNode?: NodeDataDto, containerOfRemovingNode?: NodeDataDto) {
        if (parentOfRemovingNode) {
            PdsDiagramHelper.onNodeScrolling(parentOfRemovingNode.id);
        }
        else {
            if (containerOfRemovingNode) {
                PdsDiagramHelper.onNodeScrolling(containerOfRemovingNode.id);
            }
        }
    }

    // get children inside container (for,forEach)
    public static gettingGroupedItemStarts(nodeData: NodeDataDto[], item: NodeDataDto, children: NodeDataDto[] = []): NodeDataDto[] {
        let groupedChildren: NodeDataDto[] = [];
        groupedChildren = nodeData.filter(e => e.groupId === item.id);
        for (let index = 0; index < groupedChildren.length; index++) {
            const element = groupedChildren[index];
            children.push(classToClass<NodeDataDto>(element));
            PdsDiagramHelper.gettingGroupedItemStarts(nodeData, element, children);
        }
        return children;
    }

    // get child container with children (try,catch,finally,if,else,branch with children)
    public static getChildrenInsideChildren(nodeData: NodeDataDto[], selectedItem?: NodeDataDto): CopyNodeChildDto[] {
        let children: CopyNodeChildDto[] = [];
        let childContainers = PdsDiagramHelper.getChildContainers(nodeData, selectedItem);
        for (let index = 0; index < childContainers.length; index++) {
            const element = childContainers[index];
            let copyNodeBranchObj = new CopyNodeChildDto();
            copyNodeBranchObj.node = classToClass<NodeDataDto>(element);
            copyNodeBranchObj.children = [];
            if (copyNodeBranchObj.node.isContainer) {
                copyNodeBranchObj.children = PdsDiagramHelper.gettingGroupedItemStarts(nodeData, copyNodeBranchObj.node, []);
            }
            children.push(copyNodeBranchObj);
        }
        return children;
    }

    // get children node type wise (ex. try,catch,finally,split,join,steps,branch,if,else,valid,invalid)
    public static getChildContainers(nodeData: NodeDataDto[], selectedItem?: NodeDataDto): NodeDataDto[] {
        let childContainers: NodeDataDto[] = [];
        switch (selectedItem?.nodeType) {
            case EProcessStepTemplateType.Exception:
            case EProcessStepTemplateType.Split:
                childContainers = nodeData.filter(e => e.containerKey === selectedItem?.id);
                break;
            case EProcessStepTemplateType.Decision:
            case EProcessStepTemplateType.SchemaValidation:
            case EProcessStepTemplateType.Parallel:
                childContainers = nodeData.filter(e => (PdsDiagramHelper.isAllChildOfSpecialNodeType(e)) && e.parentId === selectedItem?.id);
                break;
            default:
                break;
        }
        return childContainers;
    }

    public static isAllChildOfSpecialNodeType(node: NodeDataDto): boolean {
        let isSpecialChild: boolean = (node.originalType === 'cs-text'
            || PdsDiagramHelper.isAllChildOfSpecialNodeTypeWithoutTextNode(node));
        return isSpecialChild;
    }

    // is node child(container without text) of special node or not
    public static isAllChildOfSpecialNodeTypeWithoutTextNode(node: NodeDataDto): boolean {
        let isSpecialChildExceptTextNode: boolean = (node.originalType === 'cs-branch'
            || node.originalType === 'cs-if-branch' || node.originalType === 'cs-else-branch'
            || node.originalType === 'cs-valid' || node.originalType === 'cs-invalid');
        return isSpecialChildExceptTextNode;
    }

    public static setInitialStartNode(nodeData: NodeDataDto[]) {
        let startNode = nodeData.find(c => c.type === 'cs-start-process')
        if (!startNode) {
            let node = new NodeDataDto();
            node.id = new Guid().toString();
            node.serverId = node.id;
            node.name = 'Start';
            node.type = `cs-start-process`;
            node.originalType = `cs-start-process`;
            node.category = 'hidden-category';
            node.isDeleteAllowed = false;
            node.toolboxWidthToHeightRatio = 1;
            node.containerChildren = [];
            node.isContainer = false;
            node.disabled = false;
            node.isProcessExecuting = false;
            node.isProcessDebugging = false;
            node.isSelectedFromTrace = false;
            node.breakPoint = BreakPointEnum.Disable;
            //node.$isNodeFromDiagram = diagramCalledFor;
            nodeData.push(node);
        }
    }

    public static getIntersectPosition(
        minAx: number, minAy: number, maxAx: number, maxAy: number,
        minBx: number, minBy: number, maxBx: number, maxBy: number
    ) {
        return { left: minAx < minBx, above: minAy < minBy }
    }

    // public static setBreakPointPropertyValue(findNode: NodeDataDto) {
    //     let properties: NeuronProperty[] = PdsDiagramHelper.getNeuronPropertyList(findNode);
    //     if (properties.length > 0) {
    //         for (let index = 0; index < properties.length; index++) {
    //             const element = properties[index];
    //             if (element.list && element.list.length > 0) {
    //                 let nameProperty = element.list.find(c => c.name?.toLowerCase() === 'breakpoint');
    //                 if (nameProperty) {
    //                     (<StringNeuronProperty>nameProperty).value = PdsDiagramHelper.getBreakPointValueAsPerEnum(findNode);
    //                 }
    //             }
    //         }
    //     }
    // }

    public static getBreakPointValueAsPerEnum(findNode: NodeDataDto): string {
        let value: string = 'Disable';
        switch (findNode.breakPoint) {
            case BreakPointEnum.Enable:
                value = 'Enable';
                break;
            case BreakPointEnum.None:
                value = 'None';
                break;
            case BreakPointEnum.Pause:
                value = 'Pause';
                break;
            case BreakPointEnum.Throw:
                value = 'Throw';
                break;
            default:
                break;
        }
        return value;
    }

    /**
* Determines first shape intersects with another
* @param minAx min x co ordinate of first shape  
* @param minAy min y co ordinate of first shape 
* @param maxAx max x co ordinate of first shape 
* @param maxAy max y co ordinate of first shape 
* @param minBx min x co ordinate of second shape
* @param minBy min y co ordinate of second shape
* @param maxBx max x co ordinate of second shape
* @param maxBy max y co ordinate of second shape
* @returns true if first shape intersects with another
*/
    public static doRectanglesIntersect(
        minAx: number, minAy: number, maxAx: number, maxAy: number,
        minBx: number, minBy: number, maxBx: number, maxBy: number
    ) {
        let aLeftOfB = maxAx < minBx;
        let aRightOfB = minAx > maxBx;
        let aAboveB = minAy > maxBy;
        let aBelowB = maxAy < minBy;
        return !(aLeftOfB || aRightOfB || aAboveB || aBelowB);
    }


    /**
     * Set Accordion Header visibility
     */
    // public static setIsAccordionVisible(item: NeuronProperty[], template: any) {
    //     if (item) {
    //         for (let i = 0; i < item.length; i++) {
    //             const child = item[i];
    //             if (child.list) {
    //                 let isVisible = child.list.find(c => c.isVisible === true);
    //                 if (isVisible) {
    //                     item[i].$isAccordionHeaderShown = true;
    //                 }
    //             }
    //             switch (template.templateType) {
    //                 case EProcessStepTemplateType.Decision:
    //                 case EProcessStepTemplateType.Parallel:
    //                     for (let index = 0; index < template.branches.length; index++) {
    //                         const branchProperties = template.branches[index].properties;
    //                         for (let j = 0; j < branchProperties.length; j++) {
    //                             const element = branchProperties[j];
    //                             let isVisible = (<NeuronProperty>element)?.list?.find(c => c.isVisible === true);
    //                             if (isVisible) {
    //                                 element.$isAccordionHeaderShown = true;
    //                             }
    //                         }

    //                     }
    //                     break;
    //                 case EProcessStepTemplateType.Split:
    //                     if(template.xPathSplitter) {
    //                         const xPathSplitterProperties = template.xPathSplitter.properties;
    //                         for (let i = 0; i < xPathSplitterProperties.length; i++) {
    //                             const element = xPathSplitterProperties[i];
    //                             let isVisible = (<NeuronProperty>element)?.list?.find(c => c.isVisible === true);
    //                             if (isVisible) {
    //                                 element.$isAccordionHeaderShown = true;
    //                             }
    //                         }
    //                     }
                            
    //                     if(template.codeSplitter){
    //                         const codeSplitterProperties = template.codeSplitter.properties;
    //                         for (let i = 0; i < codeSplitterProperties.length; i++) {
    //                             const element = codeSplitterProperties[i];
    //                             let isVisible = (<NeuronProperty>element)?.list?.find(c => c.isVisible === true);
    //                             if (isVisible) {
    //                                 element.$isAccordionHeaderShown = true;
    //                             }
    //                         }
    //                     }
    //                     if(template.codeAggregator){
    //                         const codeAggregatorProperties = template.codeAggregator.properties;
    //                         for (let i = 0; i < codeAggregatorProperties.length; i++) {
    //                             const element = codeAggregatorProperties[i];
    //                             let isVisible = (<NeuronProperty>element)?.list?.find(c => c.isVisible === true);
    //                             if (isVisible) {
    //                                 element.$isAccordionHeaderShown = true;
    //                             }
    //                         }
    //                     }
    //                     if(template.wrapperAggregator){
    //                         const wrapperAggregatorProperties = template.wrapperAggregator.properties;
    //                         for (let i = 0; i < wrapperAggregatorProperties.length; i++) {
    //                             const element = wrapperAggregatorProperties[i];
    //                             let isVisible = (<NeuronProperty>element)?.list?.find(c => c.isVisible === true);
    //                             if (isVisible) {
    //                                 element.$isAccordionHeaderShown = true;
    //                             }
    //                         }
    //                     }
    //                     break;

    //                 default:
    //                     break;
    //             }
    //         }
    //     }
    // }

    /**
     * get neuron property list according to data
     */
    // public static getNeuronPropertyList(nodeData: NodeDataDto): NeuronProperty[] {

    //     let neuronPropertyList: NeuronProperty[] = [];
    //     if (nodeData.data instanceof PipelineStepOption) {
    //         neuronPropertyList = (<PipelineStepOption>nodeData.data)?.template?.properties || [];
    //     }
    //     else if (nodeData.data instanceof BranchModel) {
    //         neuronPropertyList = (<BranchModel>nodeData.data)?.properties || [];
    //     }
    //     else if (nodeData.data instanceof PipelineStepGroupModel) {
    //         neuronPropertyList = (<PipelineStepGroupModel>nodeData.data)?.properties || [];
    //     }
    //     else if (nodeData.data instanceof SplitterModel) {
    //         neuronPropertyList = (<SplitterModel>nodeData.data)?.properties || [];
    //     }
    //     else if (nodeData.data instanceof AggregatorModel) {
    //         neuronPropertyList = (<AggregatorModel>nodeData.data)?.properties || [];
    //     }
    //     else {
    //         neuronPropertyList = [];
    //     }
    //     return neuronPropertyList;
    // }

    //#region methods related to get sequenced shapes
    public static getSequencedShapes(shapes: any) {
        //debugger;
        let sequencedShapes: any[] = [];
        console.log(shapes);
        let startShape = shapes.find((e: any) => e?.dataItem?.type == 'cs-start-process');
        sequencedShapes.push(startShape);
        this.addFurtherSequencedShapes(shapes, sequencedShapes, startShape, EnumFindNodeTye.Basic);
        return sequencedShapes;
    }

    public static formatNodeName(name: string | undefined): string {
        let returnVal = '';
        if (name) {
            if (name.includes('-')) {
                let splitArray = name.split('-');
                let arr = [];
                if (splitArray.length > 0) {

                    for (let i = 0; i < splitArray.length; i++) {
                        let element = splitArray[i];
                        element = element.trim();
                        arr.push(element);
                    }

                }
                returnVal = arr.join('-').toLowerCase();
            }
            else {
                returnVal = name.replace(/ +/g, '-').toLowerCase();
            }

        }
        return returnVal;

    }

    public static getDxDiagramNodeList(serverNodeList: PipelineStepOption[]): NodeDataDto[] {
        let list: NodeDataDto[] = [];
    
        for (let i = 0; i < serverNodeList.length; i++) {
            let element = serverNodeList[i];
            if (element.displayInToolbox) {
                let node = PdsDiagramHelper.getNodeDataByType(element);
                if (node) {
                    list.push(node);
                }
            }
        }
        return list;
      }

    public static getNodeDataByType(serverNode: PipelineStepOption): NodeDataDto | undefined {
        if (serverNode) {
            let node = new NodeDataDto();
            node.name = serverNode.name || '';
            node.description = serverNode.description;
            node.type = `cs-${PdsDiagramHelper.formatNodeName(node.name)}`;
            node.originalType = `cs-${PdsDiagramHelper.formatNodeName(node.name)}`;
            node.category = PdsDiagramHelper.formatNodeName(serverNode.path);
            node.nodeType = serverNode?.template?.templateType;
            node.isDeleteAllowed = true;
            node.toolboxWidthToHeightRatio = 1;
            //node.backgroundImageUrl = DiagramTemplateToolboxHelper.getBackgroundImageUrl(node.type);
            node.isContainer = false;
            node.containerChildren = [];
            //node.data = plainToInstance(PipelineStepOption, serverNode);
    
    
            switch (serverNode.template.templateType) {
    
                case EProcessStepTemplateType.Base:
                    node.containerChildren = [];
                    break;
    
                case EProcessStepTemplateType.Decision:
                    debugger;
                    let nodeProperties = <DecisionStepModel>(serverNode.template);
                    if (nodeProperties && nodeProperties.branches) {
                        for (let i = 0; i < nodeProperties?.branches.length; i++) {

                            let childContainerData = new ChildDataDto();
                            const element = nodeProperties?.branches[i];
                            childContainerData.data = plainToClass(BranchModel, element);
                            if (element.properties)
                                for (let j = 0; j < element.properties.length; j++) {
                                    const props = element.properties[j];
                                    if (props.list) {
                                        let find = props.list.find((e: { propertyName: string; }) => e.propertyName && e.propertyName.toLowerCase().trim() == 'name');
                                        if (find && find.$type && find.$type.includes('StringNeuronProperty')) {
                                            let data = find;
                                            childContainerData.name = '';
                                            childContainerData.edgeName = data.value;
                                            childContainerData.isContainer = true;

                                        }
                                    }
                                }
                            node.containerChildren.push(childContainerData);
                        }
                    }


                    break;
    
                case EProcessStepTemplateType.Code:
                    node.containerChildren = [];
                    break;
    
                default:
                    break;
            }
    
    
            //node = DiagramTemplateToolboxHelper.setDefaultNameProp(node);
    
            return node;
        }
        else {
            return undefined;
        }
    
      }

    public static addFurtherSequencedShapes(shapes: any, sequencedShapes: any, startShape: any, findNodeType: EnumFindNodeTye) {
        let find = this.findNextNode(shapes, startShape, findNodeType);
        if ((<NodeDataDto>find?.dataItem)) {
            switch ((<NodeDataDto>find?.dataItem)?.nodeType) {
                case EProcessStepTemplateType.Base:
                case EProcessStepTemplateType.Code:
                    {
                        sequencedShapes.push(find);
                        this.addFurtherSequencedShapes(shapes, sequencedShapes, find, EnumFindNodeTye.Basic);
                    }
                    break;

                case EProcessStepTemplateType.Parallel:
                case EProcessStepTemplateType.Decision:
                    {
                        sequencedShapes.push(find);
                        let childrenContainers = shapes.filter((e: any) => e?.dataItem?.parentId === find?.dataItem?.id && PdsDiagramHelper.isAllChildOfSpecialNodeTypeWithoutTextNode((<NodeDataDto>e.dataItem)));
                        for (let i = 0; i < childrenContainers?.length; i++) {
                            let childContainer = childrenContainers[i];
                            sequencedShapes.push(childContainer);
                            this.fillBranchChild(shapes, sequencedShapes, childContainer);
                        }

                        if (!PdsDiagramHelper.isChildOfDecisionNode((<NodeDataDto>find.dataItem))) {
                            this.addFurtherSequencedShapes(shapes, sequencedShapes, find, EnumFindNodeTye.Container);
                        }
                    }
                    break;

                case EProcessStepTemplateType.PipelineStepGroup:
                    {
                        sequencedShapes.push(find);
                        this.fillBranchChild(shapes, sequencedShapes, find);
                        this.addFurtherSequencedShapes(shapes, sequencedShapes, find, EnumFindNodeTye.Basic);
                    }
                    break;

                case EProcessStepTemplateType.Exception:
                    {
                        sequencedShapes.push(find);
                        let tryContainer = shapes.find((e: any) => e?.dataItem?.name === "Try" && e?.dataItem?.containerKey === find?.dataItem?.id && e?.dataItem?.originalType === 'cs-try');
                        if (tryContainer) {
                            sequencedShapes.push(tryContainer);
                            this.fillBranchChild(shapes, sequencedShapes, tryContainer);
                        }
                        let catchContainer = shapes.find((e: any) => e?.dataItem?.name === "Catch" && e?.dataItem?.containerKey === find?.dataItem?.id && e?.dataItem?.originalType === 'cs-catch');
                        if (catchContainer) {
                            sequencedShapes.push(catchContainer);
                            this.fillBranchChild(shapes, sequencedShapes, catchContainer);
                        }
                        let finallyContainer = shapes.find((e: any) => e?.dataItem?.name === "Finally" && e?.dataItem?.containerKey === find?.dataItem?.id && e?.dataItem?.originalType === 'cs-finally');
                        if (finallyContainer) {
                            sequencedShapes.push(finallyContainer);
                            this.fillBranchChild(shapes, sequencedShapes, finallyContainer);
                        }
                        this.addFurtherSequencedShapes(shapes, sequencedShapes, find, EnumFindNodeTye.Basic);
                    }
                    break;

                case EProcessStepTemplateType.SchemaValidation:
                    {
                        sequencedShapes.push(find);
                        let validContainer = shapes.find((e: any) => e?.dataItem?.name === "Valid" && e?.dataItem?.parentId === find?.dataItem?.id && e?.dataItem?.originalType === 'cs-valid');
                        if (validContainer) {
                            sequencedShapes.push(validContainer);
                            this.fillBranchChild(shapes, sequencedShapes, validContainer);
                        }
                        let invalidContainer = shapes.find((e: any) => e?.dataItem?.name === "Invalid" && e?.dataItem?.parentId === find?.dataItem?.id && e?.dataItem?.originalType === 'cs-invalid');
                        if (invalidContainer) {
                            sequencedShapes.push(invalidContainer);
                            this.fillBranchChild(shapes, sequencedShapes, invalidContainer);
                        }
                        this.addFurtherSequencedShapes(shapes, sequencedShapes, find, EnumFindNodeTye.Container);
                    }
                    break;

                case EProcessStepTemplateType.Split:
                    {
                        sequencedShapes.push(find);
                        let splitterShape = shapes.find((e: any) => e?.dataItem?.containerKey === find?.dataItem?.id && (e?.dataItem?.originalType === 'cs-hidden-code-split' || e?.dataItem?.originalType === 'cs-hidden-xpath-split'));
                        if (splitterShape) {
                            sequencedShapes.push(splitterShape);
                        }
                        let aggregatorShape = shapes.find((e: any) => e?.dataItem?.containerKey === find?.dataItem?.id && (e?.dataItem?.originalType === 'cs-hidden-code-join' || e?.dataItem?.originalType === 'cs-hidden-null-join' || e?.dataItem?.originalType === 'cs-hidden-wrapper-join'));
                        if (aggregatorShape) {
                            sequencedShapes.push(aggregatorShape);
                        }
                        let stepsContainer = shapes.find((e: any) => e?.dataItem?.containerKey === find?.dataItem?.id && e?.dataItem?.originalType === 'cs-steps');
                        if (stepsContainer) {
                            sequencedShapes.push(stepsContainer);
                            this.fillBranchChild(shapes, sequencedShapes, stepsContainer);
                        }
                        this.addFurtherSequencedShapes(shapes, sequencedShapes, find, EnumFindNodeTye.Basic);
                    }
                    break;

            }
        }
    }

    public static findNextNode(shapes: any, startShape: any, findNodeType: EnumFindNodeTye) {
        let find: any;
        switch (findNodeType) {
            case EnumFindNodeTye.Self:
                find = startShape;
                break;
            case EnumFindNodeTye.Basic:
                find = shapes.find((e: any) => e?.dataItem?.parentId === startShape?.dataItem?.id);
                break;
            case EnumFindNodeTye.Container:
                find = shapes.find((e: any) => e?.dataItem?.parentId == startShape?.dataItem?.id && !PdsDiagramHelper.isAllChildOfSpecialNodeType((<NodeDataDto>e.dataItem)));
                break;
            default:
                find = undefined;
                break;
        }
        return find;
    }

    public static fillBranchChild(shapes: any, sequencedShapes: any, childContainer: any) {
        let firstShape = shapes.find((e: any) => e?.dataItem?.containerKey === childContainer?.dataItem?.id && !e?.dataItem?.parentId);
        if (firstShape) {
            this.addFurtherSequencedShapes(shapes, sequencedShapes, firstShape, EnumFindNodeTye.Self);
        }
    }
    //#endregion

    //#region  methods related to node context menu

    /**
     * Provides the  context menu list for the  selected node
     * @param selectedItem selected node in the dev extreme diagram 
     * @returns context menu list for the  selected node
     */

    public static addBreakpointContextMenu(selectedItem: NodeDataDto, contextMenuList: ContextMenuDto[]) {
        if (selectedItem.originalType !== 'cs-start-process' &&
            selectedItem.originalType !== 'cs-drop-here') {
            if (!selectedItem.containerType) {
                if (selectedItem.breakPoint === BreakPointEnum.Enable) {
                    contextMenuList.push(new ContextMenuDto('cs_remove_breakpoint', 'Remove Breakpoint', '', []));
                }
                else {
                    contextMenuList.push(new ContextMenuDto('cs_add_breakpoint', 'Add Breakpoint', '', []));
                }
            }
        }
    }

    public static addEnableDisableContextMenu(selectedItem: NodeDataDto, contextMenuList: ContextMenuDto[]) {
        if (selectedItem.originalType !== 'cs-start-process' &&
            selectedItem.originalType !== 'cs-drop-here') {

            if (!(selectedItem.containerType === EnumContainerType.ContainerChild
                && selectedItem.nodeType === EProcessStepTemplateType.Base)) {
                if (selectedItem.disabled) {
                    contextMenuList.push(new ContextMenuDto('cs_enable', 'Enable', '', []));
                }
                else {
                    contextMenuList.push(new ContextMenuDto('cs_disable', 'Disable', '', []));
                }
            }
        }
    }

    public static addCopyCutPasteContextMenu(selectedItem: NodeDataDto, contextMenuList: ContextMenuDto[], isPasteEnable:boolean) {
        if (selectedItem.containerType !== EnumContainerType.ContainerChild) {
            let pasteText = isPasteEnable? `Paste`:(`<span class='disabled'>Paste</span>`);
            if (selectedItem.originalType === 'cs-start-process' ||
                selectedItem.originalType === 'cs-drop-here') {
                contextMenuList.push(new ContextMenuDto('cs_paste', pasteText, '', []))
            }
            else {
                contextMenuList.push(new ContextMenuDto('cs_copy', 'Copy', '', []),
                    new ContextMenuDto('cs_cut', 'Cut', '', []),
                    new ContextMenuDto('cs_paste', pasteText, '', []))
            }
        }
    }

    public static addRemoveContextMenu(selectedItem: NodeDataDto, contextMenuList: ContextMenuDto[]) {
        if (selectedItem.isDeleteAllowed) {
            contextMenuList.push(new ContextMenuDto('cs_remove', 'Remove', '', []));
        }
    }

    //#endregion 



    public static stepHeader = ``;
    public static stepFooter = ``;
    public static showHeaderText = ``;
    public static showFooterText = ``;

    public static setHeaderFooterLanguageOfMirrorSharp(type: string) {
        if (type == 'cs-c#') {

            this.stepHeader = `
          #define DEBUG
          #define TRACE
          
          using System;
          using System.Collections;
          using System.Collections.Generic;
          using System.Collections.Specialized;
          using System.Linq;
          using System.Xml;
          using System.Xml.Linq;
          using Neuron.ServiceModel;
          using Neuron.Pipelines;
          using Neuron.Esb;
          using Newtonsoft.Json;
          using Newtonsoft.Json.Linq;
          
          namespace __DynamicCode
          {
              public class __PipelineStep__ : Neuron.Pipelines.PipelineStep<Neuron.Esb.ESBMessage>
              {
                  public override ProcessType StepType { get { return ProcessType.CSharpClass; } }
          
                  protected override void OnExecute(PipelineContext<Neuron.Esb.ESBMessage> context)
                  {`;

            this.stepFooter = `
                }
            }
        }`;

            this.showHeaderText = `
          void OnExecute(PipelineContext<Neuron.Esb.ESBMessage> context)
          {`;

            this.showFooterText = `}`;
        }
        else if (type == 'cs-vb.net') {

            this.stepHeader = `Imports System
            Imports System.Collections
            Imports System.Collections.Generic
            Imports System.Collections.Specialized
            Imports System.Linq
            Imports System.Xml
            Imports System.Xml.Linq
            Imports Neuron.ServiceModel
            Imports Neuron.Pipelines
            Imports Neuron.Esb
            Imports Newtonsoft.Json
            Imports Newtonsoft.Json.Linq
            
            Namespace __DynamicCode
                Public Class __PipelineStep__
                    Inherits PipelineStep(Of ESBMessage)
                    Protected Overrides Sub OnExecute(ByVal context As PipelineContext(Of ESBMessage))`;

            this.stepFooter = `
            End Sub
        End Class
    End Namespace`;

            this.showHeaderText = `
          Sub OnExecute(ByVal context As PipelineContext(Of ESBMessage))`;

            this.showFooterText = `End Sub`;

        }
        else {
            this.stepHeader = ``;
            this.stepFooter = ``;
            this.showHeaderText = ``;
            this.showFooterText = ``;
        }
    }


    //#region set header footer text for mirror sharp which open in popup by clicking node
    public static getHeaderNamespaceText(node?: NodeDataDto): string {
        let headerNamespaceText: string = '';
        switch (node?.originalType) {
            case 'cs-hidden-code-split':
                headerNamespaceText = `
                using System;
                using System.Linq;
                using System.Xml;
                using System.Xml.Linq;
                using System.Collections;
                using System.Collections.Specialized;
                using System.Collections.Generic;
                using Neuron.ServiceModel;
                using Neuron.Pipelines;
                using Neuron.Esb;
                using Newtonsoft.Json;
                using Newtonsoft.Json.Linq;
                namespace _DynamicCode_ 
                { 
                    public class Type2f454ff305c4b24958367c2f3747a2 : Neuron.Pipelines.Splitter<Neuron.Esb.ESBMessage,Neuron.Esb.ESBMessage> 
                    { 
                        public override `;
                break;
            case 'cs-hidden-code-join':
                headerNamespaceText = `
                using System;
                using System.Linq;
                using System.Xml;
                using System.Xml.Linq;
                using System.Collections;
                using System.Collections.Specialized;
                using System.Collections.Generic;
                using Neuron.ServiceModel;
                using Neuron.Pipelines;
                using Neuron.Esb;
                using Newtonsoft.Json;
                using Newtonsoft.Json.Linq;
                
                namespace _DynamicCode_ 
                { 
                    public class Type474c7caae5e43c086a4995f2f1259f : Neuron.Pipelines.Aggregator<Neuron.Esb.ESBMessage,Neuron.Esb.ESBMessage> 
                    { 
                        public override `;
                break;
            default:
                headerNamespaceText = '';
                break;
        }
        return headerNamespaceText;
    }

    public static getHeaderText(node?: NodeDataDto): string {
        let headerText: string = '';
        switch (node?.originalType) {
            case 'cs-hidden-code-split':
                headerText = 'IEnumerable<PipelineContext<ESBMessage>> Split(PipelineContext<ESBMessage> context){';
                break;
            case 'cs-hidden-code-join':
                headerText = 'void Aggregate(PipelineContext<ESBMessage> context, IEnumerable<PipelineContext<ESBMessage>> splits){';
                break;
            default:
                headerText = '';
                break;
        }
        return headerText;
    }

    public static getFooterNamespaceText(node?: NodeDataDto): string {
        let footerNamespaceText: string = '';
        switch (node?.originalType) {
            case 'cs-hidden-code-split':
                footerNamespaceText = `}
                public override IEnumerable<PipelineContext<ESBMessage>> Split(PipelineContext<ESBMessage> context, bool aysnc, int threads)
                { 
                    return Split(context);
                }
            }`;
                break;
            case 'cs-hidden-code-join':
                footerNamespaceText = `}
            }`;
                break;
            default:
                footerNamespaceText = '';
                break;
        }
        return footerNamespaceText;
    }

    public static getFooterText(node?: NodeDataDto): string {
        let footerText: string = '';
        switch (node?.originalType) {
            case 'cs-hidden-code-split':
            case 'cs-hidden-code-join':
                footerText = `}`;
                break;
            default:
                footerText = '';
                break;
        }
        return footerText;
    }
    //#endregion

    public static isChildOfDecisionNode(node: NodeDataDto): boolean {
        let isSpecialChildOfDecision: boolean = (node.originalType === 'cs-text'
            || PdsDiagramHelper.isContainerChildOfDecisionNode(node));
        return isSpecialChildOfDecision;
    }

    // is node container child of decision node or not
    public static isContainerChildOfDecisionNode(node: NodeDataDto): boolean {
        let isSpecialContainerChildOfDecision: boolean = (node.originalType === 'cs-if-branch'
            || node.originalType === 'cs-else-branch');
        return isSpecialContainerChildOfDecision;
    }

    public static isSpecialNodeTypeWithBranches(node: NodeDataDto): boolean {
        let isSpecial: boolean = (node.nodeType === EProcessStepTemplateType.Decision
            || node.nodeType === EProcessStepTemplateType.SchemaValidation
            || node.nodeType === EProcessStepTemplateType.Parallel);

        return isSpecial;
    }
    public static setNodeValues(values: NodeDataDto, nodeList: NodeDataDto[]) {
        let insertingNodeDetail = classToClass<NodeDataDto | undefined>(nodeList?.find(e => e.type === values?.type));
        if (insertingNodeDetail) {
            values.id = new Guid().toString();
            values.serverId = values.id;
            values.name = insertingNodeDetail.name;
            values.description = insertingNodeDetail.description;
            values.originalType = insertingNodeDetail.originalType;
            values.$originalName = insertingNodeDetail.$originalName;
            values.category = insertingNodeDetail.category;
            values.nodeType = insertingNodeDetail.nodeType;
            values.isDeleteAllowed = insertingNodeDetail.isDeleteAllowed;
            values.toolboxWidthToHeightRatio = insertingNodeDetail.toolboxWidthToHeightRatio;
            values.backgroundImageUrl = insertingNodeDetail.backgroundImageUrl;
            values.containerChildren = insertingNodeDetail.containerChildren;
            values.isContainer = insertingNodeDetail.isContainer;
            values.disabled = false;
            values.isProcessExecuting = false;
            values.isProcessDebugging = false;
            values.isSelectedFromTrace = false;
            values.breakPoint = BreakPointEnum.Disable;
            //values.data = insertingNodeDetail.data;
            values.$isFormlyFormValid = true;
            values.$isStepValid = true;
        }
    }
    public static getDropHereNode(values: NodeDataDto): NodeDataDto {
        let node = new NodeDataDto();
        node.id = new Guid().toString();
        node.serverId = node.id;
        node.name = 'Drop Here';
        node.type = `cs-drop-here`;
        node.originalType = `cs-drop-here`;
        node.category = 'hidden-category';
        node.groupId = values.id;
        node.containerKey = values.id;
        node.nodeType = EProcessStepTemplateType.Base;
        node.isDeleteAllowed = false;
        node.toolboxWidthToHeightRatio = 1;
        node.disabled = false;
        node.isProcessExecuting = false;
        node.isProcessDebugging = false;
        node.isSelectedFromTrace = false;
        node.breakPoint = BreakPointEnum.Disable;
        return node;
    }

    public static fillChildrenOfValues(values: NodeDataDto, nodeDataSourceToBeUpdated: INodeEdgeOperation[], edgeDataSourceToBeUpdated: INodeEdgeOperation[], nodeList: NodeDataDto[]): NodeDataDto[] {
        let containerData: NodeDataDto[] = [];
        if (values && values.containerChildren && values.containerChildren.length) {
            containerData = PdsDiagramHelper.setChildrenNodeRelatedData(values, nodeDataSourceToBeUpdated, edgeDataSourceToBeUpdated, nodeList);
        }
        console.log(containerData);
        return containerData;
    }

    public static setChildrenNodeRelatedData(values: NodeDataDto,
        nodeDataSourceToBeUpdated: INodeEdgeOperation[],
        edgeDataSourceToBeUpdated: INodeEdgeOperation[],
        nodeList: NodeDataDto[]
    ): NodeDataDto[] {
        let nodeContainerData: NodeDataDto[] = [];
        //debugger;
        if (values && values.containerChildren) {
            switch (values.nodeType) {
                case EProcessStepTemplateType.Decision:
                    {
                        for (let index = 0; index < values.containerChildren.length; index++) {
                            const element = values.containerChildren[index];

                            //#region insert text node to connect decision node to child containers
                            let textNode = new NodeDataDto();
                            textNode.id = new Guid().toString();
                            textNode.serverId = textNode.id;
                            textNode.isContainer = false;
                            textNode.name = (element.edgeName) ? element.edgeName : '';
                            textNode.type = 'cs-text';
                            textNode.originalType = textNode.type;
                            textNode.category = 'hidden-category';
                            textNode.groupId = values.id;
                            textNode.isDeleteAllowed = false;
                            textNode.toolboxWidthToHeightRatio = 1;
                            textNode.data = element.data;
                            textNode.containerType = EnumContainerType.ContainerChild;
                            textNode.parentId = values.id;
                            textNode.containerKey = values.containerKey;
                            textNode.disabled = false;
                            textNode.isProcessExecuting = false;
                            textNode.isProcessDebugging = false;
                            textNode.isSelectedFromTrace = false;
                            textNode.breakPoint = BreakPointEnum.Disable;
                            textNode.nodeType = values.nodeType;
                            textNode.$isNodeFromDiagram = values.$isNodeFromDiagram;

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: textNode
                            });

                            if (textNode.parentId) {
                                let textEdge = new EdgeDataDto();
                                textEdge.id = new Guid().toString();
                                textEdge.hidden = false;
                                textEdge.showPlusIcon = true; 
                                textEdge.text = undefined;
                                textEdge.fromId = textNode.parentId;
                                textEdge.toId = textNode.id;
                                textEdge.toLineEndType = 'none';

                                edgeDataSourceToBeUpdated.push({
                                    type: "insert",
                                    data: textEdge
                                });
                            }
                            //#endregion

                            //#region create child node and update related data
                            let node = new NodeDataDto();
                            node.id = new Guid().toString();
                            node.serverId = node.id;
                            node.isContainer = element.isContainer;
                            node.name = (element.edgeName) ? element.edgeName : '';
                            node.type = 'verticalContainer';
                            node.originalType = (node.name === 'Else')? 'cs-else-branch':'cs-if-branch';
                            if(index == 0){
                                node.$originalName = 'If';
                            }else if(index > 0 && index < values.containerChildren.length - 1){
                                node.$originalName = 'Branch';
                            }else{
                                node.$originalName = 'Else';
                            }
                            node.category = values.category;
                            node.groupId = values.id;
                            node.isDeleteAllowed = false;
                            node.toolboxWidthToHeightRatio = 1;
                            node.containerType = EnumContainerType.ContainerChild;
                            node.parentId = values.id;
                            node.containerKey = values.containerKey;
                            node.disabled = false;
                            node.isProcessExecuting = false;
                            node.isProcessDebugging = false;
                            node.isSelectedFromTrace = false;
                            node.breakPoint = BreakPointEnum.Disable;
                            node.nodeType = values.nodeType;
                            node.$isNodeFromDiagram = values.$isNodeFromDiagram;

                           // set value of id property in data
                            // let data = <BranchModel>(element?.data);
                            // node.data = instanceToInstance<BranchModel>(data);
                            // if (node.data && node.data.properties) {
                            //     DiagramDragDropHelper.setIdPropertyValue(node.data.properties, node.id);
                            // }

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: node
                            });

                            if (textNode.id) {
                                let edge = new EdgeDataDto();
                                edge.id = new Guid().toString();
                                edge.hidden = false;
                                edge.showPlusIcon = false; 
                                edge.text = undefined;
                                edge.fromId = textNode.id;
                                edge.toId = node.id;

                                edgeDataSourceToBeUpdated.push({
                                    type: "insert",
                                    data: edge
                                });
                            }

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: PdsDiagramHelper.getDropHereNode(node)
                            });

                            nodeContainerData.push(node);
                            //#endregion

                            //#region update decision data
                            // set value of id property in data
                            // let decisionData = (<PipelineStepOption>values.data);
                            // let decisionTemplate = <DecisionStepModel>decisionData.template;
                            // if (decisionTemplate.branches && decisionTemplate.branches.length === values.containerChildren.length) {
                            //     let branchData = <BranchModel>(decisionTemplate.branches[index]);
                            //     if (branchData && branchData.properties) {
                            //         DiagramDragDropHelper.setIdPropertyValue(branchData.properties, node.id);
                            //     }
                            // }
                            //#endregion
                        }
                    }
                    break;
                case EProcessStepTemplateType.Parallel:
                    {
                        for (let index = 0; index < values.containerChildren.length; index++) {
                            const element = values.containerChildren[index];

                            //#region create child node and update related data
                            let node = new NodeDataDto();
                            node.id = new Guid().toString();
                            node.serverId = node.id;
                            node.isContainer = element.isContainer;
                            node.name = (element.name) ? element.name : '';
                            node.type = 'verticalContainer';
                            node.originalType = 'cs-branch';
                            if (index == 0) {
                                node.$originalName = 'Branch';
                            } else {
                                node.$originalName = 'New Branch';
                            }
                            node.category = values.category;
                            node.groupId = values.id;
                            node.isDeleteAllowed = false;
                            node.toolboxWidthToHeightRatio = 1;
                            node.containerType = EnumContainerType.ContainerChild;
                            node.parentId = values.id;
                            node.containerKey = values.containerKey;
                            node.disabled = false;
                            node.isProcessExecuting = false;
                            node.isProcessDebugging = false;
                            node.isSelectedFromTrace = false;
                            node.breakPoint = BreakPointEnum.Disable;
                            node.nodeType = values.nodeType;
                            node.$isNodeFromDiagram = values.$isNodeFromDiagram;

                            // set value of id property in data
                            // let data = <BranchModel>(element?.data);
                            // node.data = instanceToInstance<BranchModel>(data);
                            // if (node.data && node.data.properties) {
                            //     DiagramDragDropHelper.setIdPropertyValue(node.data.properties, node.id);
                            // }

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: node
                            });

                            if (node.parentId) {
                                let edge = new EdgeDataDto();
                                edge.id = new Guid().toString();
                                edge.hidden = false;
                                edge.showPlusIcon = true; 
                                edge.text = undefined;
                                edge.fromId = node.parentId;
                                edge.toId = node.id;

                                edgeDataSourceToBeUpdated.push({
                                    type: "insert",
                                    data: edge
                                });
                            }

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: PdsDiagramHelper.getDropHereNode(node)
                            });

                            nodeContainerData.push(node);
                            //#endregion

                            //#region update parallel data
                            // set value of id property in data
                            // let parallelData = (<PipelineStepOption>values.data);
                            // let parallelTemplate = <ParallelStepModel>parallelData.template;
                            // if (parallelTemplate.branches && parallelTemplate.branches.length === values.containerChildren.length) {
                            //     let branchData = <BranchModel>(parallelTemplate.branches[index]);
                            //     if (branchData && branchData.properties) {
                            //         DiagramDragDropHelper.setIdPropertyValue(branchData.properties, node.id);
                            //     }
                            // }
                            //#endregion
                        }
                    }
                    break;
                case EProcessStepTemplateType.Exception:
                    {
                        for (let index = 0; index < values.containerChildren.length; index++) {
                            const element = values.containerChildren[index];

                            //#region create child node and update related data
                            let node = new NodeDataDto();
                            node.id = new Guid().toString();
                            node.serverId = node.id;
                            node.isContainer = element.isContainer;
                            node.name = (element.name) ? element.name : '';
                            node.type = 'verticalContainer';
                            if (node.name === 'Try') {
                                node.originalType = 'cs-try';
                            }
                            else if (node.name === 'Catch') {
                                node.originalType = 'cs-catch';
                            }
                            else{
                                node.originalType = 'cs-finally';
                            }
                            node.category = values.category;
                            node.groupId = values.id;
                            node.isDeleteAllowed = false;
                            node.toolboxWidthToHeightRatio = 1;
                            node.containerType = EnumContainerType.ContainerChild;
                            node.parentId = (index > 0) ? (nodeContainerData[index - 1].id) : undefined;
                            node.containerKey = values.id;
                            node.disabled = false;
                            node.isProcessExecuting = false;
                            node.isProcessDebugging = false;
                            node.isSelectedFromTrace = false;
                            node.breakPoint = BreakPointEnum.Disable;
                            node.nodeType = EProcessStepTemplateType.PipelineStepGroup;
                            node.$isNodeFromDiagram = values.$isNodeFromDiagram;

                            // set value of id property in data
                            // let data = <PipelineStepGroupModel>(element?.data);
                            // node.data = instanceToInstance<PipelineStepGroupModel>(data);
                            // (<PipelineStepGroupModel>node.data).id = node.id;
                            // if (node.data && node.data.properties) {
                            //     DiagramDragDropHelper.setIdPropertyValue(node.data.properties, node.id);
                            // }

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: node
                            });

                            if (node.parentId) {
                                let edge = new EdgeDataDto();
                                edge.id = new Guid().toString();
                                edge.hidden = true;
                                edge.showPlusIcon = true; 
                                edge.text = undefined;
                                edge.fromId = node.parentId;
                                edge.toId = node.id;

                                edgeDataSourceToBeUpdated.push({
                                    type: "insert",
                                    data: edge
                                });
                            }

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: PdsDiagramHelper.getDropHereNode(node)
                            });

                            nodeContainerData.push(node);
                            //#endregion

                            //#region update exception data
                            // set value of id property in data
                            // let exceptionData = (<PipelineStepOption>values.data);
                            // let exceptionTemplate = <ExceptionStepModel>exceptionData.template;
                            // if (element.name === 'Try') {
                            //     let tryData = <PipelineStepGroupModel>(exceptionTemplate.try);
                            //     tryData.id = node.id;
                            //     if (tryData && tryData.properties) {
                            //         DiagramDragDropHelper.setIdPropertyValue(tryData.properties, node.id);
                            //     }
                            // }
                            // else if (element.name === 'Catch') {
                            //     let catchData = <PipelineStepGroupModel>(exceptionTemplate.catch);
                            //     catchData.id = node.id;
                            //     if (catchData && catchData.properties) {
                            //         DiagramDragDropHelper.setIdPropertyValue(catchData.properties, node.id);
                            //     }
                            // }
                            // else {
                            //     let finallyData = <PipelineStepGroupModel>(exceptionTemplate.finally);
                            //     finallyData.id = node.id;
                            //     if (finallyData && finallyData.properties) {
                            //         DiagramDragDropHelper.setIdPropertyValue(finallyData.properties, node.id);
                            //     }
                            // }
                            //#endregion
                        }
                    }
                    break;
                case EProcessStepTemplateType.SchemaValidation:
                    {
                        for (let index = 0; index < values.containerChildren.length; index++) {
                            const element = values.containerChildren[index];

                            //#region create child node and update related data
                            let node = new NodeDataDto();
                            node.id = new Guid().toString();
                            node.serverId = node.id;
                            node.isContainer = element.isContainer;
                            node.name = (element.name) ? element.name : '';
                            node.type = 'verticalContainer';
                            if (node.name === 'Valid') {
                                node.originalType = 'cs-valid';
                            }
                            else{
                                node.originalType = 'cs-invalid';
                            }
                            node.category = values.category;
                            node.groupId = values.id;
                            node.isDeleteAllowed = false;
                            node.toolboxWidthToHeightRatio = 1;
                            node.containerType = EnumContainerType.ContainerChild;
                            node.parentId = values.id;
                            node.containerKey = values.containerKey;
                            node.disabled = false;
                            node.isProcessExecuting = false;
                            node.isProcessDebugging = false;
                            node.isSelectedFromTrace = false;
                            node.breakPoint = BreakPointEnum.Disable;
                            node.nodeType = EProcessStepTemplateType.PipelineStepGroup;
                            node.$isNodeFromDiagram = values.$isNodeFromDiagram;

                            // set value of id property in data
                            // let data = <PipelineStepGroupModel>(element?.data);
                            // node.data = instanceToInstance<PipelineStepGroupModel>(data);
                            // (<PipelineStepGroupModel>node.data).id = node.id;
                            // if (node.data && node.data.properties) {
                            //     DiagramDragDropHelper.setIdPropertyValue(node.data.properties, node.id);
                            // }

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: node
                            });

                            if (node.parentId) {
                                let edge = new EdgeDataDto();
                                edge.id = new Guid().toString();
                                edge.hidden = false;
                                edge.showPlusIcon = true; 
                                edge.text = undefined;
                                edge.fromId = node.parentId;
                                edge.toId = node.id;

                                edgeDataSourceToBeUpdated.push({
                                    type: "insert",
                                    data: edge
                                });
                            }

                            if (index === 0) {
                                nodeDataSourceToBeUpdated.push({
                                    type: "insert",
                                    data: PdsDiagramHelper.getDropHereNode(node)
                                });
                            }

                            nodeContainerData.push(node);
                            //#endregion

                            //#region update schema validation data
                            // set value of id property in data
                            // let schemaValidationData = (<PipelineStepOption>values.data);
                            // let schemaValidationTemplate = <SchemaValidationStepModel>schemaValidationData.template;
                            // if (element.name === 'Valid') {
                            //     let validData = <PipelineStepGroupModel>(schemaValidationTemplate.onValid);
                            //     validData.id = node.id;
                            //     if (validData && validData.properties) {
                            //         DiagramDragDropHelper.setIdPropertyValue(validData.properties, node.id);
                            //     }
                            // }
                            // else {
                            //     let invalidData = <PipelineStepGroupModel>(schemaValidationTemplate.onInvalid);
                            //     invalidData.id = node.id;
                            //     if (invalidData && invalidData.properties) {
                            //         DiagramDragDropHelper.setIdPropertyValue(invalidData.properties, node.id);
                            //     }
                            // }
                            //#endregion
                        }

                        let cancelNodeData = nodeList.find(e => e.name === 'Cancel');
                        if (cancelNodeData) {
                            let node = classToClass<NodeDataDto>(cancelNodeData);
                            node.id = new Guid().toString();
                            node.serverId = node.id;
                            node.containerKey = (nodeContainerData.length > 1) ? nodeContainerData[1].id : undefined;
                            node.groupId = (nodeContainerData.length > 1) ? nodeContainerData[1].id : undefined;
                            node.disabled = false;
                            node.isProcessExecuting = false;
                            node.isProcessDebugging = false;
                            node.isSelectedFromTrace = false;
                            node.breakPoint = BreakPointEnum.Disable;
                            node.$isNodeFromDiagram = values.$isNodeFromDiagram;
                            
                            //PdsDiagramHelper.setValueDataProperties(node);

                            nodeDataSourceToBeUpdated.push({
                                type: "insert",
                                data: node
                            });
                        }
                    }
                    break;
                
                default:
                    break;
            }
        }
        return nodeContainerData;
    }
    public static shiftExistingParent(values: NodeDataDto, containerData: NodeDataDto[],
        edgeDataSourceToBeUpdated: INodeEdgeOperation[], nodeData: NodeDataDto[],
        edgeData: EdgeDataDto[], isIntersectedDropHere: boolean,
        intersectPosition?: { left: boolean; above: boolean; }) {
        debugger;
        let parentNode = nodeData.find(e => e.id === values.parentId);
        if (parentNode) {
            if (!isIntersectedDropHere && parentNode.type !== 'cs-start-process'
                && intersectPosition?.above) {
                // update inserting node
                values.parentId = parentNode?.parentId;
                values.groupId = parentNode?.groupId;
                values.containerKey = parentNode?.containerKey;

                // update parentNode
                parentNode.parentId = values.id;
                parentNode.groupId = values.groupId;
                parentNode.containerKey = values.containerKey;
                let connectedToEdges = edgeData.filter(e => e.toId === parentNode?.id);
                for (let index = 0; index < connectedToEdges.length; index++) {
                    const element = connectedToEdges[index];
                    edgeDataSourceToBeUpdated.push({ type: "remove", key: element.id });
                }

                // make edge of old parent of inserting node
                if (PdsDiagramHelper.isSpecialNodeTypeWithBranches(values)) {
                    PdsDiagramHelper.addParentChildEdge(containerData, parentNode, edgeDataSourceToBeUpdated, false);
                }
                else {
                    PdsDiagramHelper.addParentChildEdge([values], parentNode, edgeDataSourceToBeUpdated);
                }
            }
        }
    }
    public static addParentChildEdge(fromData: NodeDataDto[], toData: NodeDataDto, edgeDataSourceToBeUpdated: INodeEdgeOperation[], showPlusIcon : boolean = true, lineEndExpr:string = 'filledTriangle') {
        for (let index = 0; index < fromData.length; index++) {
            const element = fromData[index];
            let edge = new EdgeDataDto();
            edge.id = new Guid().toString();
            edge.fromId = element.id;
            edge.toId = toData.id;
            edge.toLineEndType = lineEndExpr;
            edge.showPlusIcon = showPlusIcon; 
            edgeDataSourceToBeUpdated.push(
                {
                    type: "insert",
                    data: edge
                }
            )
        }
    }

    public static updateNodeParentAndAddEdge(values: NodeDataDto, edgeDataSourceToBeUpdated: INodeEdgeOperation[],
        nodeDataSourceToBeUpdated: INodeEdgeOperation[], containerData: NodeDataDto[], nodeData: NodeDataDto[], edgeData: EdgeDataDto[]) {
        // find parentNode
        debugger;
        let parentNode = nodeData.find(e => e.id === values.parentId);
        if (parentNode) {

            // find sibling
            let siblingNeedToBeShifted: NodeDataDto | undefined;
            if (PdsDiagramHelper.isSpecialNodeTypeWithBranches(parentNode)) {
                siblingNeedToBeShifted = nodeData.find(e => e.parentId === values.parentId && !PdsDiagramHelper.isAllChildOfSpecialNodeType(e));
            }
            else {
                siblingNeedToBeShifted = nodeData.find(e => e.parentId === values.parentId);
            }
            // if has sibling shift it after new inserted node and add edges
            if (siblingNeedToBeShifted) {

                let connectedEdgeOfSiblingNode = edgeData.find(e => e.toId === siblingNeedToBeShifted?.id);
                if (connectedEdgeOfSiblingNode) {
                    let findAddNode = nodeData.find(e => e.id === connectedEdgeOfSiblingNode?.fromId);
                    if (findAddNode?.originalType === 'cs-add-node') {
                        nodeDataSourceToBeUpdated.push({ type: "remove", key: findAddNode.id });
                    }
                }

                PdsDiagramHelper.updateSiblingRemoveOldEdges(siblingNeedToBeShifted, values, edgeDataSourceToBeUpdated, edgeData);

                // insert edge of sibling node
                let newInsertedChildContainers: NodeDataDto[] = [];
                if (PdsDiagramHelper.isSpecialNodeTypeWithBranches(values)) {
                    newInsertedChildContainers = containerData.filter(e => PdsDiagramHelper.isAllChildOfSpecialNodeTypeWithoutTextNode(e));
                    PdsDiagramHelper.addParentChildEdge(newInsertedChildContainers, siblingNeedToBeShifted, edgeDataSourceToBeUpdated, false);
                }
                else {
                    newInsertedChildContainers = [values];
                    PdsDiagramHelper.addParentChildEdge(newInsertedChildContainers, siblingNeedToBeShifted, edgeDataSourceToBeUpdated);
                }
                
            }

            // finally insert edge of new inserted node
            if (PdsDiagramHelper.isSpecialNodeTypeWithBranches(parentNode)) {
                let childContainersOfParent = nodeData.filter(e => e.parentId === parentNode?.id && PdsDiagramHelper.isAllChildOfSpecialNodeTypeWithoutTextNode(e));
                PdsDiagramHelper.addParentChildEdge(childContainersOfParent, values, edgeDataSourceToBeUpdated, false);
            }
            else {
                PdsDiagramHelper.addParentChildEdge([parentNode], values, edgeDataSourceToBeUpdated);
            }
        }
        else {
            // do nothing
        }
    }
    public static updateSiblingRemoveOldEdges(siblingNeedToBeShifted: NodeDataDto,
        values: NodeDataDto, edgeDataSourceToBeUpdated: INodeEdgeOperation[], edgeData: EdgeDataDto[]) {
        siblingNeedToBeShifted.parentId = values.id;
        let connectedEdges = edgeData.filter(e => e.toId === siblingNeedToBeShifted?.id);
        if (connectedEdges) {
            // remove existing edge and add new edge with new inserting node
            for (let index = 0; index < connectedEdges.length; index++) {
                const element = connectedEdges[index];
                edgeDataSourceToBeUpdated.push({ type: "remove", key: element.id });
            }
        }
    }
}
