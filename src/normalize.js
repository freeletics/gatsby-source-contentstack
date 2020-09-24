exports.processContentType = (contentType, createNodeId, createContentDigest, typePrefix) => {
  const nodeId = createNodeId(`${typePrefix.toLowerCase()}-contentType-${contentType.uid}`);
  const nodeContent = JSON.stringify(contentType);
  const nodeData = {
    ...contentType,
    id: nodeId,
    parent: null,
    children: [],
    internal: {
      type: `${typePrefix}ContentTypes`,
      content: nodeContent,
      contentDigest: createContentDigest(nodeContent),
    },
  };
  return nodeData;
};

exports.processAsset = (asset, createNodeId, createContentDigest, typePrefix) => {
  const nodeId = makeAssetNodeUid(asset, createNodeId, typePrefix);
  const nodeContent = JSON.stringify(asset);
  const nodeData = {
    ...asset,
    id: nodeId,
    parent: null,
    children: [],
    internal: {
      type: `${typePrefix}_assets`,
      content: nodeContent,
      contentDigest: createContentDigest(nodeContent),
    },
  };
  return nodeData;
};

const processEntry = exports.processEntry = (contentType, entry, createNodeId, createContentDigest, typePrefix, type) => {
  const nodeId = makeEntryNodeUid(entry, createNodeId, typePrefix);
  const nodeContent = JSON.stringify(entry);
  const nodeData = {
    ...entry,
    id: nodeId,
    parent: null,
    children: [],
    internal: {
      type: type || `${typePrefix}_${contentType.uid}`,
      content: nodeContent,
      contentDigest: createContentDigest(nodeContent),
    },
  };
  return nodeData;
};

exports.normalizeEntry = (contentType, entry, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams) => {
  interfaceParams = { ...interfaceParams, entry };
  const resolveEntry = {
    ...entry,
    ...builtEntry(contentType.schema, entry, entry.publish_details.locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams),
  };
  return resolveEntry;
};

const makeAssetNodeUid = exports.makeAssetNodeUid = (asset, createNodeId, typePrefix) => {
  const publishedLocale = asset.publish_details.locale;
  return createNodeId(`${typePrefix.toLowerCase()}-assets-${asset.uid}-${publishedLocale}`);
};

const makeEntryNodeUid = exports.makeEntryNodeUid = (entry, createNodeId, typePrefix) => {
  const publishedLocale = entry.publish_details.locale;
  return createNodeId(`${typePrefix.toLowerCase()}-entry-${entry.uid}-${publishedLocale}`);
};

const normalizeGroup = (field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams) => {
  let groupObj = null;
  if (field.multiple) {
    groupObj = [];
    if (value instanceof Array) {
      value.forEach((groupValue) => {
        groupObj.push(builtEntry(field.schema, groupValue, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams));
      });
    } else {
      // In some cases value is null, this makes graphql treat all the objects as null
      // So need to pass a valid array instance.
      // This also helps to handle when a user changes a group to multiple after initially
      // setting a group to single.. the server passes an object and the previous condition
      // again makes groupObj null
      groupObj.push(builtEntry(field.schema, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams));
    }
  } else {
    groupObj = {};
    groupObj = builtEntry(field.schema, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams);
  }
  return groupObj;
};

const normalizeModularBlock = (blocks, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix) => {
  const modularBlocksObj = [];
  if (value) {
    value.map((block) => {
      Object.keys(block).forEach((key) => {
        const blockSchema = blocks.filter((block) => block.uid === key);
        if (!blockSchema.length) {
          // block value no longer exists block schema so ignore it
          return;
        }
        const blockObj = {};
        blockObj[key] = builtEntry(blockSchema[0].schema, block[key], locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix);
        modularBlocksObj.push(blockObj);
      });
    });
  }
  return modularBlocksObj;
};

const normalizeReferenceField = (value, locale, entriesNodeIds, createNodeId, typePrefix) => {
  const reference = [];
  if (value && !Array.isArray(value)) return;
  value.forEach((entry) => {
    if (typeof entry === 'object' && entry.uid) {
      if (entriesNodeIds.has(createNodeId(`${typePrefix.toLowerCase()}-entry-${entry.uid}-${locale}`))) {
        reference.push(createNodeId(`${typePrefix.toLowerCase()}-entry-${entry.uid}-${locale}`));
      }
    } else if (entriesNodeIds.has(createNodeId(`${typePrefix.toLowerCase()}-entry-${entry}-${locale}`))) {
      reference.push(createNodeId(`${typePrefix.toLowerCase()}-entry-${entry}-${locale}`));
    }
  });
  return reference;
};

const normalizeFileField = (value, locale, assetsNodeIds, createNodeId, typePrefix) => {
  let reference = {};
  if (Array.isArray(value)) {
    reference = [];
    value.forEach((assetUid) => {
      if (assetsNodeIds.has(createNodeId(`${typePrefix.toLowerCase()}-assets-${assetUid}-${locale}`))) {
        reference.push(createNodeId(`${typePrefix.toLowerCase()}-assets-${assetUid}-${locale}`));
      }
    });
  } else if (assetsNodeIds.has(createNodeId(`${typePrefix.toLowerCase()}-assets-${value}-${locale}`))) {
    reference = createNodeId(`${typePrefix.toLowerCase()}-assets-${value}-${locale}`);
  }
  return reference;
};

const getSchemaValue = (obj, key) => {
  if (obj === null) return null;
  if (typeof obj !== 'object') return null;
  return Object.prototype.hasOwnProperty.call(obj, key.uid) ? obj[key.uid] : null;
};

const builtEntry = (schema, entry, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams) => {
  const entryObj = {};
  schema.forEach((field) => {
    let value = getSchemaValue(entry, field);
    switch (field.data_type) {
      case 'reference':
        entryObj[`${field.uid}___NODE`] = value && normalizeReferenceField(value, locale, entriesNodeIds, createNodeId, typePrefix);
        break;
      case 'file':
        // Issue #60. Graphql does not treat empty string as null.
        if (!value) value = null;
        entryObj[`${field.uid}___NODE`] = value && normalizeFileField(value, locale, assetsNodeIds, createNodeId, typePrefix);
        break;
      case 'group':
      case 'global_field':
        // Create a node for global_field
        if (field.data_type === 'global_field') {
          // object to track the object type name
          interfaceParams.globalField = {};
          interfaceParams.globalField.path = `${typePrefix}_${interfaceParams.contentType.uid}_${field.uid}`; // This field will be appended with field uids separated by pipe character

          let newEntryObj = normalizeGroup(field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams);
          newEntryObj = {
            ...newEntryObj,
            publish_details: { locale: interfaceParams.entry.publish_details.locale },
            uid: `${interfaceParams.entry.uid}${field.uid}`
          };

          const type = interfaceParams.globalField.path;
          const entryNode = processEntry(interfaceParams.contentType, newEntryObj, createNodeId, interfaceParams.createContentDigest, typePrefix, type);
          entryObj[field.uid] = entryNode;
          interfaceParams.createNode(entryNode);
        } else {
          // Creates a node for global field children
          if (interfaceParams && interfaceParams.globalField && interfaceParams.globalField.path) {
            // updates object for right type names inside global field
            interfaceParams.globalField.path = `${interfaceParams.globalField.path}|${field.uid}`;

            let newEntryObj = normalizeGroup(field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams);
            newEntryObj = {
              ...newEntryObj,
              publish_details: { locale: interfaceParams.entry.publish_details.locale },
              uid: `${interfaceParams.entry.uid}${field.uid}`
            };
            // Gets the type name for children of global fields
            const type = interfaceParams.globalField.path.split('|').join('_');

            const entryNode = processEntry(interfaceParams.contentType, newEntryObj, createNodeId, interfaceParams.createContentDigest, typePrefix, type);
            entryObj[field.uid] = entryNode;
            interfaceParams.createNode(entryNode);
          } else {
            entryObj[field.uid] = normalizeGroup(field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix);
          }
        }
        if (interfaceParams && interfaceParams.globalField && interfaceParams.globalField.path) {
          // Update the type name after recursive call is done
          let path = interfaceParams.globalField.path.split('|');
          path.splice(path.length - 1, 1); // Gets path to previous state of globalField.path
          interfaceParams.globalField.path = path.join('|');
        }
        break;
      case 'blocks':
        entryObj[field.uid] = normalizeModularBlock(field.blocks, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix);
        break;
      default:
        entryObj[field.uid] = value;
    }
  });
  return entryObj;
};

const buildBlockCustomSchema = (blocks, types, references, groups, parent, prefix, globalField = {}) => {

  const blockFields = {};
  let blockType, blockInterface;

  if (globalField.extendedInterface) {
    blockInterface = `interface ${globalField.extendedInterface} @nodeInterface {id: ID! `; // Space in the end is required
    blockType = `type ${parent} implements Node & ${globalField.extendedInterface} {`;
  } else {
    blockType = `type ${parent} {`;
  }

  blocks.forEach((block) => {

    let newparent = parent.concat(block.uid);
    let extendedInterfaceBlock;

    if (globalField.extendedInterface) {
      extendedInterfaceBlock = globalField.extendedInterface.concat(block.uid);
      let blockString = `${block.uid} : ${extendedInterfaceBlock} `;
      blockInterface = blockInterface.concat(blockString);
      blockType = blockType.concat(blockString);
    } else {
      blockType = blockType.concat(`${block.uid} : ${newparent} `);
    }

    const { fields } = buildCustomSchema(block.schema, types, references, groups, newparent, prefix, globalField);

    for (const key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields[key], 'type')) {
        fields[key] = fields[key].type;
      }
    }
    if (Object.keys(fields).length > 0) {

      let type;

      // Handles condition when modular block is nested inside global field
      if (globalField.extendedInterface) {
        const _interface = `interface ${extendedInterfaceBlock} @nodeInterface ${JSON.stringify({ ...fields, id: 'ID!' }).replace(/"/g, '')}`;
        types.push(_interface);

        type = `type ${newparent} implements Node & ${extendedInterfaceBlock} ${JSON.stringify(fields).replace(/"/g, '')}`;
      } else {
        type = `type ${newparent} ${JSON.stringify(fields).replace(/"/g, '')}`;
      }

      types.push(type);

      blockFields[block.uid] = globalField.extendedInterface ? globalField.extendedInterface : newparent;
    }
  });

  if (globalField.extendedInterface) {
    blockInterface = blockInterface.concat('}');
    types.push(blockInterface);
  }

  blockType = blockType.concat('}');
  return blockType;
};

exports.extendSchemaWithDefaultEntryFields = (schema) => {
  schema.push({
    data_type: "text",
    uid: "uid",
    multiple: false,
    mandatory: false,
  });
  schema.push({
    data_type: "text",
    uid: "locale",
    multiple: false,
    mandatory: false,
  });
  schema.push({
    data_type: "group",
    uid: "publish_details",
    schema: [{
      data_type: "text",
      uid: "locale",
      multiple: false,
      mandatory: false,
    }],
    multiple: false,
    mandatory: false,
  });
  schema.push({
    data_type: "isodate",
    uid: "updated_at",
    multiple: false,
    mandatory: false,
  });
  schema.push({
    data_type: "string",
    uid: "updated_by",
    multiple: false,
    mandatory: false,
  });
  return schema;
}

const buildCustomSchema = exports.buildCustomSchema = (schema, types, references, groups, parent, prefix, globalField = {}) => {
  const fields = {};
  groups = groups || [];
  references = references || [];
  types = types || [];
  schema.forEach((field) => {
    switch (field.data_type) {
      case 'text':
        fields[field.uid] = {
          resolve: (source) => source[field.uid] || null,
        };
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid].type = '[String]!';
          } else {
            fields[field.uid].type = 'String!';
          }
        } else if (field.multiple) {
          fields[field.uid].type = '[String]';
        } else {
          fields[field.uid].type = 'String';
        }
        break;
      case 'isodate':
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid] = '[Date]!';
          } else {
            fields[field.uid] = 'Date!';
          }
        } else if (field.multiple) {
          fields[field.uid] = '[Date]';
        } else {
          fields[field.uid] = 'Date';
        }
        break;
      case 'boolean':
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid] = '[Boolean]!';
          } else {
            fields[field.uid] = 'Boolean!';
          }
        } else if (field.multiple) {
          fields[field.uid] = '[Boolean]';
        } else {
          fields[field.uid] = 'Boolean';
        }
        break;
      case 'number':
        fields[field.uid] = {
          resolve: (source) => source[field.uid] || null,
        };
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid].type = '[Int]!';
          } else {
            fields[field.uid].type = 'Int!';
          }
        } else if (field.multiple) {
          fields[field.uid].type = '[Int]';
        } else {
          fields[field.uid].type = 'Int';
        }
        break;
      case 'link':
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid] = '[linktype]!';
          } else {
            fields[field.uid] = 'linktype!';
          }
        } else if (field.multiple) {
          fields[field.uid] = '[linktype]';
        } else {
          fields[field.uid] = 'linktype';
        }
        break;
      case 'file':
        const type = `type ${prefix}_assets implements Node { url: String }`;
        types.push(type);
        fields[field.uid] = {
          resolve: (source, args, context) => {
            if (field.multiple && source[`${field.uid}___NODE`]) {
              const nodesData = [];
              source[`${field.uid}___NODE`].forEach((id) => {
                context.nodeModel.getAllNodes({
                  type: `${prefix}_assets`,
                }).find((node) => {
                  if (node.id === id) {
                    nodesData.push(node);
                  }
                });
              });
              return nodesData;
            }

            if (source[`${field.uid}___NODE`]) {
              return context.nodeModel.getAllNodes({
                type: `${prefix}_assets`,
              })
                .find((node) => node.id === source[`${field.uid}___NODE`]);
            }
            return null;
          },
        };
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid].type = `[${prefix}_assets]!`;
          } else {
            fields[field.uid].type = `${prefix}_assets!`;
          }
        } else if (field.multiple) {
          fields[field.uid].type = `[${prefix}_assets]`;
        } else {
          fields[field.uid].type = `${prefix}_assets`;
        }
        break;
      case 'group':
      case 'global_field':
        let newparent = parent.concat('_', field.uid);

        // Handles nested modular blocks and groups inside global field
        if (field.data_type === 'global_field') {
          globalField.path = prefix + '_' + field.reference_to;
          globalField.extendedInterface = globalField.path;
        }
        // Updates extendedInterface and globalField.path before recursive call
        if (globalField.extendedInterface && field.data_type !== 'global_field') {
          globalField.path = `${globalField.path}|${field.uid}`;
          globalField.extendedInterface = globalField.path.split('|').join('_');
        }

        const result = buildCustomSchema(field.schema, types, references, groups, newparent, prefix, globalField);

        for (const key in result.fields) {
          if (Object.prototype.hasOwnProperty.call(result.fields[key], 'type')) {
            result.fields[key] = result.fields[key].type;
          }
        }

        if (Object.keys(result.fields).length > 0) {

          let _interface, type;

          // Creates an interface for global_field, keeps it independent of content type.
          if (field.data_type === 'global_field') {
            _interface = `interface ${globalField.path} @nodeInterface ${JSON.stringify({ ...result.fields, id: 'ID!' }).replace(/"/g, '')}`;
            types.push(_interface);

            type = `type ${newparent} implements Node & ${globalField.path} ${JSON.stringify(result.fields).replace(/"/g, '')}`;

          } else {
            // Checks groups inside global fields
            if (globalField.extendedInterface) {
              // Creates a common interface for groups inside global_fields, for backwards compatibility
              _interface = `interface ${globalField.extendedInterface} @nodeInterface ${JSON.stringify({ ...result.fields, id: 'ID!' }).replace(/"/g, '')}`;
              types.push(_interface);

              type = `type ${newparent} implements Node & ${globalField.extendedInterface} ${JSON.stringify(result.fields).replace(/"/g, '')}`;

            } else {
              type = `type ${newparent} ${JSON.stringify(result.fields).replace(/"/g, '')}`;
            }
          }

          types.push(type);

          groups.push({
            parent,
            field,
          });

          // Handles type names for groups inside global field
          newparent = globalField.extendedInterface ? globalField.extendedInterface : newparent;

          if (field.mandatory) {
            if (field.multiple) {
              fields[field.uid] = `[${newparent}]!`;
            } else {
              fields[field.uid] = `${newparent}!`;
            }
          } else if (field.multiple) {
            fields[field.uid] = `[${newparent}]`;
          } else {
            fields[field.uid] = `${newparent}`;
          }
        }

        if (globalField.extendedInterface) {
          globalField.extendedInterface = globalField.path.split('|');
          globalField.extendedInterface.splice(globalField.extendedInterface.length - 1, 1); // Removes last element
          globalField.path = globalField.extendedInterface.join('|'); // gets globalField.path previous state as last recursive call is done
          globalField.extendedInterface = globalField.extendedInterface.join('_'); // gets extendedInterface to previous state.
        }

        break;
      case 'blocks':
        let blockparent = parent.concat('_', field.uid);

        if (globalField.extendedInterface) {
          globalField.path = `${globalField.path}|${field.uid}`;
          globalField.extendedInterface = globalField.path.split('|').join('_');
        }

        const blockType = buildBlockCustomSchema(field.blocks, types, references, groups, blockparent, prefix, globalField);

        types.push(blockType);
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid] = `[${blockparent}]!`;
          } else {
            fields[field.uid] = `${blockparent}!`;
          }
        } else if (field.multiple) {
          fields[field.uid] = `[${blockparent}]`;
        } else {
          fields[field.uid] = `${blockparent}`;
        }

        if (globalField.extendedInterface) {
          globalField.extendedInterface = globalField.path.split('|');
          globalField.extendedInterface.splice(globalField.extendedInterface.length - 1, 1);
          globalField.path = globalField.extendedInterface.join('|');
          globalField.extendedInterface = globalField.extendedInterface.join('_');
        }

        break;
      case 'reference':
        let unionType = 'union ';
        if (typeof field.reference_to === 'string' || field.reference_to.length === 1) {
          field.reference_to = Array.isArray(field.reference_to) ? field.reference_to[0] : field.reference_to;
          const type = `type ${prefix}_${field.reference_to} implements Node { title: String! }`;
          types.push(type);
          if (field.mandatory) {
            fields[field.uid] = `[${prefix}_${field.reference_to}]!`;
          } else {
            fields[field.uid] = `[${prefix}_${field.reference_to}]`;
          }
        } else {
          const unions = [];
          field.reference_to.forEach((reference) => {
            const referenceType = `${prefix}_${reference}`;
            unionType = unionType.concat(referenceType);
            unions.push(referenceType);
            const type = `type ${referenceType} implements Node { title: String! }`;
            types.push(type);
          });
          let name = '';
          name = name.concat(unions.join(''), '_Union');
          unionType = unionType.concat('_Union = ', unions.join(' | '));
          types.push(unionType);

          references.push({
            parent,
            uid: field.uid,
          });

          if (field.mandatory) {
            fields[field.uid] = `[${name}]!`;
          } else {
            fields[field.uid] = `[${name}]`;
          }
        }
        break;
    }
  });
  return {
    fields,
    types,
    references,
    groups,
  };
};
