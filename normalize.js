'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.processContentType = function (contentType, createNodeId, createContentDigest, typePrefix) {
  var nodeId = createNodeId(typePrefix.toLowerCase() + '-contentType-' + contentType.uid);
  var nodeContent = (0, _stringify2.default)(contentType);
  var nodeData = (0, _extends3.default)({}, contentType, {
    id: nodeId,
    parent: null,
    children: [],
    internal: {
      type: typePrefix + 'ContentTypes',
      content: nodeContent,
      contentDigest: createContentDigest(nodeContent)
    }
  });
  return nodeData;
};

exports.processAsset = function (asset, createNodeId, createContentDigest, typePrefix) {
  var nodeId = makeAssetNodeUid(asset, createNodeId, typePrefix);
  var nodeContent = (0, _stringify2.default)(asset);
  var nodeData = (0, _extends3.default)({}, asset, {
    id: nodeId,
    parent: null,
    children: [],
    internal: {
      type: typePrefix + '_assets',
      content: nodeContent,
      contentDigest: createContentDigest(nodeContent)
    }
  });
  return nodeData;
};

var processEntry = exports.processEntry = function (contentType, entry, createNodeId, createContentDigest, typePrefix, type) {
  var nodeId = makeEntryNodeUid(entry, createNodeId, typePrefix);
  var nodeContent = (0, _stringify2.default)(entry);
  var nodeData = (0, _extends3.default)({}, entry, {
    id: nodeId,
    parent: null,
    children: [],
    internal: {
      type: type || typePrefix + '_' + contentType.uid,
      content: nodeContent,
      contentDigest: createContentDigest(nodeContent)
    }
  });
  return nodeData;
};

exports.normalizeEntry = function (contentType, entry, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams) {
  interfaceParams = (0, _extends3.default)({}, interfaceParams, { entry: entry });
  var resolveEntry = (0, _extends3.default)({}, entry, builtEntry(contentType.schema, entry, entry.publish_details.locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams));
  return resolveEntry;
};

var makeAssetNodeUid = exports.makeAssetNodeUid = function (asset, createNodeId, typePrefix) {
  var publishedLocale = asset.publish_details.locale;
  return createNodeId(typePrefix.toLowerCase() + '-assets-' + asset.uid + '-' + publishedLocale);
};

var makeEntryNodeUid = exports.makeEntryNodeUid = function (entry, createNodeId, typePrefix) {
  var publishedLocale = entry.publish_details.locale;
  return createNodeId(typePrefix.toLowerCase() + '-entry-' + entry.uid + '-' + publishedLocale);
};

var normalizeGroup = function normalizeGroup(field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams, isGlobalField) {
  var groupObj = null;
  if (field.multiple) {
    groupObj = [];
    if (value instanceof Array) {
      value.forEach(function (groupValue) {
        groupObj.push(builtEntry(field.schema, groupValue, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams, isGlobalField));
      });
    } else {
      // In some cases value is null, this makes graphql treat all the objects as null
      // So need to pass a valid array instance.
      // This also helps to handle when a user changes a group to multiple after initially
      // setting a group to single.. the server passes an object and the previous condition
      // again makes groupObj null
      groupObj.push(builtEntry(field.schema, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams, isGlobalField));
    }
  } else {
    groupObj = {};
    groupObj = builtEntry(field.schema, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams, isGlobalField);
  }
  return groupObj;
};

var normalizeModularBlock = function normalizeModularBlock(blocks, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix) {
  var modularBlocksObj = [];
  if (value) {
    value.map(function (block) {
      (0, _keys2.default)(block).forEach(function (key) {
        var blockSchema = blocks.filter(function (block) {
          return block.uid === key;
        });
        if (!blockSchema.length) {
          // block value no longer exists block schema so ignore it
          return;
        }
        var blockObj = {};
        blockObj[key] = builtEntry(blockSchema[0].schema, block[key], locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix);
        modularBlocksObj.push(blockObj);
      });
    });
  }
  return modularBlocksObj;
};

var normalizeReferenceField = function normalizeReferenceField(value, locale, entriesNodeIds, createNodeId, typePrefix) {
  var reference = [];
  if (value && !Array.isArray(value)) return;
  value.forEach(function (entry) {
    if ((typeof entry === 'undefined' ? 'undefined' : (0, _typeof3.default)(entry)) === 'object' && entry.uid) {
      if (entriesNodeIds.has(createNodeId(typePrefix.toLowerCase() + '-entry-' + entry.uid + '-' + locale))) {
        reference.push(createNodeId(typePrefix.toLowerCase() + '-entry-' + entry.uid + '-' + locale));
      }
    } else if (entriesNodeIds.has(createNodeId(typePrefix.toLowerCase() + '-entry-' + entry + '-' + locale))) {
      reference.push(createNodeId(typePrefix.toLowerCase() + '-entry-' + entry + '-' + locale));
    }
  });
  return reference;
};

var normalizeFileField = function normalizeFileField(value, locale, assetsNodeIds, createNodeId, typePrefix) {
  var reference = {};
  if (Array.isArray(value)) {
    reference = [];
    value.forEach(function (assetUid) {
      if (assetsNodeIds.has(createNodeId(typePrefix.toLowerCase() + '-assets-' + assetUid + '-' + locale))) {
        reference.push(createNodeId(typePrefix.toLowerCase() + '-assets-' + assetUid + '-' + locale));
      }
    });
  } else if (assetsNodeIds.has(createNodeId(typePrefix.toLowerCase() + '-assets-' + value + '-' + locale))) {
    reference = createNodeId(typePrefix.toLowerCase() + '-assets-' + value + '-' + locale);
  }
  return reference;
};

var getSchemaValue = function getSchemaValue(obj, key) {
  if (obj === null) return null;
  if ((typeof obj === 'undefined' ? 'undefined' : (0, _typeof3.default)(obj)) !== 'object') return null;
  return Object.prototype.hasOwnProperty.call(obj, key.uid) ? obj[key.uid] : null;
};

var builtEntry = function builtEntry(schema, entry, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams, isGlobalField) {
  var entryObj = {};
  schema.forEach(function (field) {
    var value = getSchemaValue(entry, field);
    switch (field.data_type) {
      case 'reference':
        entryObj[field.uid + '___NODE'] = value && normalizeReferenceField(value, locale, entriesNodeIds, createNodeId, typePrefix);
        break;
      case 'file':
        // Issue #60. Graphql does not treat empty string as null.
        if (!value) value = null;
        entryObj[field.uid + '___NODE'] = value && normalizeFileField(value, locale, assetsNodeIds, createNodeId, typePrefix);
        break;
      case 'group':
      case 'global_field':
        // Create a node for global_field
        if (field.data_type === 'global_field') {
          // Tracks if the current object is type global_field or its children
          isGlobalField = true;
          // object to track the object type name
          interfaceParams.globalField = {};
          interfaceParams.globalField.path = typePrefix + '_' + interfaceParams.contentType.uid + '_' + field.uid; // This field will be appended with field uids separated by pipe character

          var newEntryObj = normalizeGroup(field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams, isGlobalField);
          newEntryObj = (0, _extends3.default)({}, newEntryObj, {
            publish_details: { locale: interfaceParams.entry.publish_details.locale },
            uid: '' + interfaceParams.entry.uid + field.uid
          });
          var type = interfaceParams.globalField.globalType;
          var entryNode = processEntry(contentType, newEntryObj, createNodeId, interfaceParams.createContentDigest, typePrefix, type);
          entryObj[field.uid] = entryNode;
          interfaceParams.createNode(entryNode);
        } else {
          // Creates a node for global field children
          if (isGlobalField) {
            // updates object for right type names inside global field
            interfaceParams.globalField.path = interfaceParams.globalField.path + '|' + field.uid;

            var _newEntryObj = normalizeGroup(field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix, interfaceParams, isGlobalField);
            _newEntryObj = (0, _extends3.default)({}, _newEntryObj, {
              publish_details: { locale: interfaceParams.entry.publish_details.locale },
              uid: '' + interfaceParams.entry.uid + field.uid
            });
            // Gets the type name for children of global fields
            var _type = interfaceParams.globalField.path.split('|').join('_');

            var _entryNode = processEntry(contentType, _newEntryObj, createNodeId, interfaceParams.createContentDigest, typePrefix, _type);
            entryObj[field.uid] = _entryNode;
            interfaceParams.createNode(_entryNode);
          } else {
            entryObj[field.uid] = normalizeGroup(field, value, locale, entriesNodeIds, assetsNodeIds, createNodeId, typePrefix);
          }
        }
        if (globalField) {
          // Update the type name after recursive call is done
          var path = interfaceParams.globalField.path.split('|');
          path.splice(path.length - 1, 1); // Gets path to previous state of globalField.path
          interfaceParams.globalField.path = path.join('|');
        }
        // Tracks if the current object is type global_field or its children
        isGlobalField = false;
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

var buildBlockCustomSchema = function buildBlockCustomSchema(blocks, types, references, groups, parent, prefix, globalField, extendedInterface, isGlobalField) {

  var blockFields = {};
  var blockType = 'type ' + parent + ' {';

  blocks.forEach(function (block) {
    var newparent = parent.concat(block.uid);
    blockType = blockType.concat(block.uid + ' : ' + newparent + ' ');

    var _buildCustomSchema = buildCustomSchema(block.schema, types, references, groups, newparent, prefix, globalField, extendedInterface, isGlobalField),
        fields = _buildCustomSchema.fields;

    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields[key], 'type')) {
        fields[key] = fields[key].type;
      }
    }
    if ((0, _keys2.default)(fields).length > 0) {
      var type = 'type ' + newparent + ' ' + (0, _stringify2.default)(fields).replace(/"/g, '');
      types.push(type);
      blockFields[block.uid] = '' + newparent;
    }
  });
  blockType = blockType.concat('}');
  return blockType;
};

exports.extendSchemaWithDefaultEntryFields = function (schema) {
  schema.push({
    data_type: "text",
    uid: "uid",
    multiple: false,
    mandatory: false
  });
  schema.push({
    data_type: "text",
    uid: "locale",
    multiple: false,
    mandatory: false
  });
  schema.push({
    data_type: "group",
    uid: "publish_details",
    schema: [{
      data_type: "text",
      uid: "locale",
      multiple: false,
      mandatory: false
    }],
    multiple: false,
    mandatory: false
  });
  schema.push({
    data_type: "isodate",
    uid: "updated_at",
    multiple: false,
    mandatory: false
  });
  schema.push({
    data_type: "string",
    uid: "updated_by",
    multiple: false,
    mandatory: false
  });
  return schema;
};

var buildCustomSchema = exports.buildCustomSchema = function (schema, types, references, groups, parent, prefix) {
  var globalField = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : {};
  var extendedInterface = arguments[7];
  var isGlobalField = arguments[8];

  var fields = {};
  groups = groups || [];
  references = references || [];
  types = types || [];
  schema.forEach(function (field) {
    switch (field.data_type) {
      case 'text':
        fields[field.uid] = {
          resolve: function resolve(source) {
            return source[field.uid] || null;
          }
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
          resolve: function resolve(source) {
            return source[field.uid] || null;
          }
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
        var type = 'type ' + prefix + '_assets implements Node { url: String }';
        types.push(type);
        fields[field.uid] = {
          resolve: function resolve(source, args, context) {
            if (field.multiple && source[field.uid + '___NODE']) {
              var nodesData = [];
              source[field.uid + '___NODE'].forEach(function (id) {
                context.nodeModel.getAllNodes({
                  type: prefix + '_assets'
                }).find(function (node) {
                  if (node.id === id) {
                    nodesData.push(node);
                  }
                });
              });
              return nodesData;
            }

            if (source[field.uid + '___NODE']) {
              return context.nodeModel.getAllNodes({
                type: prefix + '_assets'
              }).find(function (node) {
                return node.id === source[field.uid + '___NODE'];
              });
            }
            return null;
          }
        };
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid].type = '[' + prefix + '_assets]!';
          } else {
            fields[field.uid].type = prefix + '_assets!';
          }
        } else if (field.multiple) {
          fields[field.uid].type = '[' + prefix + '_assets]';
        } else {
          fields[field.uid].type = prefix + '_assets';
        }
        break;
      case 'group':
      case 'global_field':
        var newparent = parent.concat('_', field.uid);

        // Handles nested modular blocks and groups inside global field
        if (field.data_type === 'global_field') {
          isGlobalField = true;
          globalField.path = prefix + '_' + field.reference_to;
          extendedInterface = globalField.path;
        }
        // Updates extendedInterface and globalField.path before recursive call
        if (isGlobalField && field.data_type !== 'global_field') {
          globalField.path = globalField.path + '|' + field.uid;
          extendedInterface = globalField.path.split('|').join('_');
        }

        var result = buildCustomSchema(field.schema, types, references, groups, newparent, prefix, globalField, extendedInterface, isGlobalField);

        for (var key in result.fields) {
          if (Object.prototype.hasOwnProperty.call(result.fields[key], 'type')) {
            result.fields[key] = result.fields[key].type;
          }
        }

        if ((0, _keys2.default)(result.fields).length > 0) {

          var _interface = void 0,
              _type2 = void 0;

          // Creates an interface for global_field, keeps it independent of content type.
          if (field.data_type === 'global_field') {
            _interface = 'interface ' + globalField.path + ' @nodeInterface ' + (0, _stringify2.default)((0, _extends3.default)({}, result.fields, { id: 'ID!' })).replace(/"/g, '');
            types.push(_interface);

            _type2 = 'type ' + newparent + ' implements Node & ' + globalField.path + ' ' + (0, _stringify2.default)(result.fields).replace(/"/g, '');
          } else {
            // Checks groups inside global fields
            if (isGlobalField) {
              // Creates a common interface for groups inside global_fields, for backwards compatibility
              _interface = 'interface ' + extendedInterface + ' @nodeInterface ' + (0, _stringify2.default)((0, _extends3.default)({}, result.fields, { id: 'ID!' })).replace(/"/g, '');
              types.push(_interface);

              _type2 = 'type ' + newparent + ' implements Node & ' + extendedInterface + ' ' + (0, _stringify2.default)(result.fields).replace(/"/g, '');
            } else {
              _type2 = 'type ' + newparent + ' ' + (0, _stringify2.default)(result.fields).replace(/"/g, '');
            }
          }

          types.push(_type2);

          groups.push({
            parent: parent,
            field: field
          });

          // Handles type names for groups inside global field
          newparent = isGlobalField ? extendedInterface : newparent;

          if (field.mandatory) {
            if (field.multiple) {
              fields[field.uid] = '[' + newparent + ']!';
            } else {
              fields[field.uid] = newparent + '!';
            }
          } else if (field.multiple) {
            fields[field.uid] = '[' + newparent + ']';
          } else {
            fields[field.uid] = '' + newparent;
          }
        }

        // Sets isGlobalField to false after recursive call is done
        isGlobalField = false;

        if (extendedInterface) {
          extendedInterface = globalField.path.split('|');
          extendedInterface.splice(extendedInterface.length - 1, 1); // Removes last element
          globalField.path = extendedInterface.join('|'); // gets globalField.path previous state as last recursive call is done
          extendedInterface = extendedInterface.join('_'); // gets extendedInterface to previous state.
        }

        break;
      case 'blocks':
        var blockparent = parent.concat('_', field.uid);

        if (extendedInterface) {
          globalField.path = globalField.path + '|' + field.uid;
          extendedInterface = globalField.path.split('|').join('_');
          blockparent = extendedInterface;
        }

        var blockType = buildBlockCustomSchema(field.blocks, types, references, groups, blockparent, prefix, globalField, extendedInterface, isGlobalField);

        types.push(blockType);
        if (field.mandatory) {
          if (field.multiple) {
            fields[field.uid] = '[' + blockparent + ']!';
          } else {
            fields[field.uid] = blockparent + '!';
          }
        } else if (field.multiple) {
          fields[field.uid] = '[' + blockparent + ']';
        } else {
          fields[field.uid] = '' + blockparent;
        }

        if (extendedInterface) {
          extendedInterface = globalField.path.split('|');
          extendedInterface.splice(extendedInterface.length - 1, 1);
          globalField.path = extendedInterface.join('|');
          extendedInterface = extendedInterface.join('_');
        }

        break;
      case 'reference':
        var unionType = 'union ';
        if (typeof field.reference_to === 'string' || field.reference_to.length === 1) {
          field.reference_to = Array.isArray(field.reference_to) ? field.reference_to[0] : field.reference_to;
          var _type3 = 'type ' + prefix + '_' + field.reference_to + ' implements Node { title: String! }';
          types.push(_type3);
          if (field.mandatory) {
            fields[field.uid] = '[' + prefix + '_' + field.reference_to + ']!';
          } else {
            fields[field.uid] = '[' + prefix + '_' + field.reference_to + ']';
          }
        } else {
          var unions = [];
          field.reference_to.forEach(function (reference) {
            var referenceType = prefix + '_' + reference;
            unionType = unionType.concat(referenceType);
            unions.push(referenceType);
            var type = 'type ' + referenceType + ' implements Node { title: String! }';
            types.push(type);
          });
          var name = '';
          name = name.concat(unions.join(''), '_Union');
          unionType = unionType.concat('_Union = ', unions.join(' | '));
          types.push(unionType);

          references.push({
            parent: parent,
            uid: field.uid
          });

          if (field.mandatory) {
            fields[field.uid] = '[' + name + ']!';
          } else {
            fields[field.uid] = '[' + name + ']';
          }
        }
        break;
    }
  });
  return {
    fields: fields,
    types: types,
    references: references,
    groups: groups
  };
};