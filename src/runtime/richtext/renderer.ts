import { type VNode, createTextVNode, h, isVNode, resolveComponent } from 'vue'
import {
  type BlockNodes,
  type BlockNodesWithAttributes,
  type BlockNodesWithContent,
  type BlockNodesWithContentAndAttributes,
  type BlockNodesWithoutOptions,
  type ComponentNode,
  type MarkNodes,
  type MarkNodesWithAttributes,
  type MarkNodesWithoutOptions,
  type Node,
  NodeTypes,
  type TextNode,
  isBlockNode,
  isComponentNode,
  isTextNode
} from './types'
import {
  type Component,
  type ComponentResolvers,
  type RenderedNode,
  type Resolvers,
  defaultResolvers
} from './resolvers'

export type ResolversOption = Resolvers & {
  components?: ComponentResolvers
}

export type MergedResolvers = Required<ResolversOption>

export type RichtextClassesHeadings = {
  '1'?: string
  '2'?: string
  '3'?: string
  '4'?: string
  '5'?: string
  '6'?: string
}

export type RichtextClasses = {
  paragraph?: string
  heading?: RichtextClassesHeadings
  image?: string
  ordered_list?: string
  bullet_list?: string
  list_item?: string
  code_block?: string
  link?: string
  components?: Record < string, string >
}

export interface RendererOptions {
  resolvers: MergedResolvers
  classes: RichtextClasses,
  omitParagraphInListItems?: boolean
}

export interface RichtextRenderer {
  renderDocument: Function
}

export function createRenderer (options?: Partial<RendererOptions>): RichtextRenderer {
  const globalConfigResolvers = { ...defaultResolvers, ...options?.resolvers }
  const globalConfigClasses = options?.classes || {}
  const globalConfigOmitParagraphInListItems = options.omitParagraphInListItems || false

  let resolvers = {} as ResolversOption
  let classes = {} as RichtextClasses
  let omitParagraphInListItems = false

  const renderNode = (node: Node) => {
    if (isTextNode(node)) {
      if (!node.marks) { return renderTextNode(node) }

      return node.marks.reduce(
        (text: VNode, mark: MarkNodes) => renderMarkNode(mark, text),
        renderTextNode(node)
      )
    } else if (isBlockNode(node)) {
      return renderBlockNode(node)
    } else if (isComponentNode(node)) {
      return renderComponentNode(node)
    }

    // @TODO
    return h('div', 'fallback node')
  }

  const renderNodeList = (nodes: Node[]) => {
    const nodeList: RenderedNode[] = []

    nodes.forEach((node) => {
      const renderedNode = renderNode(node)

      if (Array.isArray(renderedNode)) {
        renderedNode.forEach((childNode) => {
          nodeList.push(childNode)
        })
      } else {
        nodeList.push(renderedNode)
      }
    })

    return nodeList
  }

  function renderBlockNode (node: BlockNodes) {
    switch (node.type) {
      // With children only
      case NodeTypes.DOCUMENT:
      case NodeTypes.PARAGRAPH:
      case NodeTypes.QUOTE:
      case NodeTypes.UL_LIST:
      case NodeTypes.LIST_ITEM:
        return resolveBlockNodeWithContent(node)

      // With children and attributes
      case NodeTypes.HEADING:
      case NodeTypes.OL_LIST:
      case NodeTypes.CODE_BLOCK:
        return resolveBlockNodeWithContentAndAttributes(node)

      // Without options
      case NodeTypes.HR:
      case NodeTypes.BR:
        return resolveBlockNodeWithoutOptions(node)

      // With attributes only
      case NodeTypes.IMAGE:
        return resolveBlockNodeWithAttributes(node)

      default:
        // @TODO fallback
        return h('div', 'fallback block')
    }
  }

  function renderMarkNode (node: MarkNodes, text: VNode) {
    switch (node.type) {
      // With text only
      case NodeTypes.BOLD:
      case NodeTypes.STRONG:
      case NodeTypes.STRIKE:
      case NodeTypes.UNDERLINE:
      case NodeTypes.ITALIC:
      case NodeTypes.CODE:
        return resolveMarkNode(node, text)

      // With attributes
      case NodeTypes.LINK:
      case NodeTypes.STYLED:
        return resolveMarkNodeWithAttributes(node, text)

      default:
        // @TODO fallback
        return h('span', 'fallback mark')
    }
  }

  function renderComponentNode (node: ComponentNode) {
    const components: RenderedNode[] = []

    node.attrs.body.forEach((body) => {
      const { component, _uid, ...fields } = body
      const resolver = resolvers.components[component]

      const props = {}
      if (classes?.components) {
        if (classes.components[component]) { props.classes = classes.components[component] }
      }

      if (typeof resolver === 'string') {
        const resolvedComponent = resolveComponent(resolver)
        components.push(
          h(resolvedComponent, { blok: body, classes: props.classes })
        )
      } else if (isComponentResolver(resolver)) {
        components.push(
          resolver({ id: node.attrs.id, component, _uid, fields })
        )
      } else {
        components.push(resolvers[NodeTypes.COMPONENT]())
      }
    })

    return components
  }

  function renderTextNode (node: TextNode) {
    return createTextVNode(node.text)
  }

  const renderChildren = (
    node: BlockNodesWithContent | BlockNodesWithContentAndAttributes
  ) => (node.content && node.content.length ? renderNodeList(node.content) : [])

  function resolveBlockNodeWithContent (node: BlockNodesWithContent) {
    const resolver = resolvers[node.type]
    // add classes to attrs
    if (!node.attrs) { node.attrs = {} }
    if (classes[node.type]) { node.attrs.classes = classes[node.type] }

    // render children if available
    let children = renderChildren(node)
    if (
      omitParagraphInListItems &&
      node.type === NodeTypes.LIST_ITEM &&
      node.content.length === 1 &&
      node.content[0].content
    ) {
      children = renderNodeList(node.content[0].content)
    }

    // try to resolve the component, if only component string is provided
    if (typeof resolver === 'string') {
      const component = resolveComponent(resolver)
      return h(component, node.attrs, { default: () => children })
    }
    // if component is already resolved (e.g. from import)
    if (isComponentResolver(resolver)) {
      return h(resolver, node.attrs, { default: () => children })
    }
    // if resolver is a vue render function
    return resolver({ children, attrs: node.attrs })
  }

  function resolveBlockNodeWithAttributes (node: BlockNodesWithAttributes) {
    const resolver = resolvers[node.type]
    // add classes to attrs
    if (classes[node.type]) { node.attrs.classes = classes[node.type] }

    // try to resolve the component, if only component string is provided
    if (typeof resolver === 'string') {
      const component = resolveComponent(resolver)
      return h(component, node.attrs)
    }
    // if component is already resolved (e.g. from import)
    if (isComponentResolver(resolver)) { return h(resolver, node.attrs) }

    // if resolver is a vue render function
    return resolver({ attrs: node.attrs })
  }

  function resolveBlockNodeWithContentAndAttributes (
    node: BlockNodesWithContentAndAttributes
  ) {
    const resolver = resolvers[node.type]
    // add classes to attrs -> id heading classes is an object
    if (node.type === NodeTypes.HEADING) {
      if (classes[node.type]) {
        if (classes[node.type][node.attrs.level]) {
          if (classes[node.type]) { node.attrs.classes = classes[node.type][node.attrs.level] }
        }
      }
    } else if (classes[node.type]) { node.attrs.classes = classes[node.type] }

    // render children
    const children = renderChildren(node)

    // try to resolve the component, if only component string is provided
    if (typeof resolver === 'string') {
      const component = resolveComponent(resolver)
      return h(component, node.attrs, { default: () => children })
    }
    // if component is already resolved (e.g. from import)
    if (isComponentResolver(resolver)) { return h(resolver, node.attrs, { default: () => children }) }

    // if resolver is a vue render function
    return resolver({
      children,
      attrs: node.attrs as never
    })
  }

  function resolveBlockNodeWithoutOptions (node: BlockNodesWithoutOptions) {
    const resolver = resolvers[node.type]

    if (isComponentResolver(resolver)) { return h(resolver) }

    return resolver()
  }

  function resolveMarkNode (node: MarkNodesWithoutOptions, text: VNode) {
    const resolver = resolvers[node.type]

    if (isComponentResolver(resolver)) { return h(resolver, { default: () => text }) }

    return resolver({ text })
  }

  function resolveMarkNodeWithAttributes (
    node: MarkNodesWithAttributes,
    text: VNode
  ) {
    const resolver = resolvers[node.type]
    // add classes to attrs
    if (classes[node.type]) { node.attrs.classes = classes[node.type] }

    // try to resolve the component, if only component string is provided
    if (typeof resolver === 'string') {
      const component = resolveComponent(resolver)
      return h(component, node.attrs, { default: () => children })
    }

    // if component is already resolved (e.g. from import)
    if (isComponentResolver(resolver)) { return h(resolver, node.attrs, { default: () => text }) }

    // if resolver is a vue render function
    return resolver({ text, attrs: node.attrs as never })
  }

  const renderDocument = (node: Node, options: RendererOptions) => {
    // merge options for classses and resolvers
    classes = mergeDeep(globalConfigClasses, options.classes)
    resolvers = mergeDeep(globalConfigResolvers, options.resolvers)
    omitParagraphInListItems = options?.omitParagraphInListItems || globalConfigOmitParagraphInListItems
    if (Array.isArray(node)) { return renderNodeList(node) }
    return renderNode(node)
  }

  return { renderDocument }
}

export function isComponentResolver (
  resolver: Resolvers[keyof Resolvers]
): resolver is Component {
  return typeof resolver !== 'function' && !isVNode(resolver)
}

/**
* Performs a deep merge of objects and returns new object. Does not modify
* objects (immutable) and merges arrays via concatenation.
*
* @param {...object} objects - Objects to merge
* @returns {object} New object with merged key/values
*/
function mergeDeep (...objects) {
  const isObject = obj => obj && typeof obj === 'object'

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach((key) => {
      const pVal = prev[key]
      const oVal = obj[key]

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal)
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal)
      } else {
        prev[key] = oVal
      }
    })

    return prev
  }, {})
}
