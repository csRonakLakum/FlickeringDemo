export interface INodeEdgeOperation {
    type: "insert" | "update" | "remove";
    data?: any;
    key?: any;
    index?: number | undefined;
  }
  
  export class FlowNode {
    id?: string;
    name?: string;
    type?: string;
    parentId?: string;
    containerKey?: string;
    groupId?: string;
  }
  
  export class FlowEdge {
    id?: string;
    fromId?: string;
    toId?: string;
    text?: string;
  }
  
  export class DiagramToMenuTransferDto {
    diagramEvent? :any
    toolboxCategoryList? : ToolboxCategory[]
    calledFor?: EnumDiagramCalledFor
  }
  
  export class ToolboxCategory {
    name: string
    caption: string
  
    constructor(name: string, caption: string) {
        this.name = name;
        this.caption = caption;
    }
  }
  
  export enum EnumDiagramCalledFor {
    MainFlow,
    GlobalExceptionHandler
  }
  
  export class NodeDataDto {
    id?: string;
    serverId?: string;
    name: string='';
    description?: string;
    type: string='';
    originalType: string ='';
    category: string='';
    parentId?: string;
    groupId?: string;
    containerKey?: string;
    containerType?: EnumContainerType;
    nodeType: EProcessStepTemplateType = EProcessStepTemplateType.Base;
    isDeleteAllowed?: boolean;
    toolboxWidthToHeightRatio: number=1;
    backgroundImageUrl?: string;
    containerChildren?: ChildDataDto[];
    isProcessExecuting? :boolean;
    isProcessDebugging? :boolean;
    isSelectedFromTrace?: boolean;
    isErrorWhileDebugging?: boolean;
    disabled?:boolean;
    isContainer?: boolean;
    breakPoint?: BreakPointEnum;
    data? : any;
    $isStepValid?: boolean = true;
    $stepError?: string;
    $isFormlyFormValid?: boolean = true;
    //$validateSubscription?: Subscription;
    $originalName?: string ;
    $isInitialDecisionLoad?: boolean = false;
    $isNodeFromDiagram?:EnumDiagramCalledFor;
  }

  export class EdgeDataDto {
    id?: string;
    fromId?: string;
    text?: string;
    toId?: string;
    showPlusIcon?:boolean;
    hidden?:boolean;
    toLineEndType?:string;
}
  
  export class ChildDataDto {
    name?: string;
    edgeName?: string;
    image? :string;
    isContainer?: boolean;
    //splitChildType?: EnumSplitChildType;
    data? :  any;
  
  
  }

  

  export class BaseStepModel implements IStepModel{
    templateType?: EProcessStepTemplateType;
    type?: string;
    //properties?: NeuronProperty[];
    id?: string;
  }

  export interface IStepModel {
    templateType?: EProcessStepTemplateType;
    type?: string;
    //properties?: NeuronProperty[];
    id?: string;
  }

  export class DecisionStepModel extends BaseStepModel {
    branches?:BranchModel[];
}

export class BranchModel {
    type?:string;
    properties?:any;
    condition?:BranchConditionModel;
    simpleCondition?: SimpleBranchConditionModel;
    //steps?:PipelineStepGroupModel;
}

export class SimpleBranchConditionModel {
    type?: string;
    $type?: string;
    //branchConditions?: ESBMessagePattern;
}

export class BranchConditionModel {
    type?:string;
    code?:string;
    headerText?:string;
    footerText?:string;
    headerTemplate?:string;
    footerTemplate?:string;
    referencedAssemblies?:string[];
}
  
  export enum EnumContainerType{
    MainContainer = 1,  // for Loop, Parallel, Decision
    MainContainerWithChild = 2,  // Exception, Split
    ContainerChild = 3   // Try Catch Finally, split step join, If else branches
  }
  
  export enum EProcessStepTemplateType {
    Base,
    Decision,
    Parallel,
    PipelineStepGroup,
    Exception,
    Split,
    SchemaValidation,
    Code,
    SplitStepModel
  }

  export class CopyNodeDto {
    nodeType?: EProcessStepTemplateType;
    node?: NodeDataDto;
    children?: CopyNodeChildDto[];
    childrenInsideContainer?: NodeDataDto[];
}

export class CopyNodeChildDto {
    node?: NodeDataDto;
    children?: NodeDataDto[];
}

export enum BreakPointEnum {
    Disable = 0,
    Enable = 1,
    Pause = 2,
    Throw = 3,
    None = 4
}

export class PipelineStepOption {
    displayInToolbox?: boolean;
    name?: string;
    description?: string;
    path?: string;
    stepType?: ProcessType;
    template: any;
    type?:string;
    //nodeType: EProcessStepTemplateType = EProcessStepTemplateType.Base;
}

export enum ProcessType
{
    Xslt,
    EncryptXml,
    DecryptXml,
    CSharpCode,
    Audit,
    Decision,
    DetectDuplicate,
    CallService,
    ValidateJSON,
    MSMQ,
    Parallel,
    Query,
    Publish,
    Rules,
    Splitter,
    ExecuteServiceEndpoint,
    ExecuteAdapterEndpoint,
    SignXml,
    Store,
    Switch,
    Branch,
    Trace,
    VBCode,
    VerifySignedXml,
    WorkflowPipeline,
    XmlQuery,
    ExcelToXml,
    JsonXml,
    PropertyTransform,
    SchemaValidation,
    ZipUnZip,
    CSharpClass,
    ExecutePipeline,
    FlatFile,
    ODBC,
    Transform,
    Break,
    Cancel,
    ReThrow,
    Push,
    Pop,
    PipelineContainer,
    Exception,
    Rest, 
    Custom,
    MQSeries,
    Scheduler,
    DataMapper
}

export class ContextMenuDto {
  name: string;
  text: string;
  icon: string;
  items: ContextMenuDto[];
  constructor(name: string, text: string, icon: string, items: ContextMenuDto[]) {
      this.name = name;
      this.text = text;
      this.icon = icon;
      this.items = items;
  }
}