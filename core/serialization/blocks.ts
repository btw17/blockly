/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Handles serializing blocks to plain JavaScript objects only
 * containing state.
 */

/**
 * Handles serializing blocks to plain JavaScript objects only containing state.
 * @namespace Blockly.serialization.blocks
 */
import * as goog from '../../closure/goog/goog';
goog.declareModuleId('Blockly.serialization.blocks');

/* eslint-disable-next-line no-unused-vars */
import {Block} from '../block';
/* eslint-disable-next-line no-unused-vars */
import {BlockSvg} from '../block_svg';
// eslint-disable-next-line no-unused-vars
import {Connection} from '../connection';
import * as eventUtils from '../events/utils';
import {inputTypes} from '../input_types';
// eslint-disable-next-line no-unused-vars
import {ISerializer} from '../interfaces/i_serializer';
import {Size} from '../utils/size';
// eslint-disable-next-line no-unused-vars
import {Workspace} from '../workspace';
import * as Xml from '../xml';

import {BadConnectionCheck, MissingBlockType, MissingConnection, RealChildOfShadow} from './exceptions';
import * as priorities from './priorities';
import * as serializationRegistry from './registry';


// TODO(#5160): Remove this once lint is fixed.
/* eslint-disable no-use-before-define */

/**
 * Represents the state of a connection.
 * @alias Blockly.serialization.blocks.ConnectionState
 */
export interface ConnectionState {
  shadow: State|undefined;
  block: State|undefined;
}

/**
 * Represents the state of a given block.
 * @alias Blockly.serialization.blocks.State
 */
export interface State {
  type: string;
  id: string|undefined;
  x: number|undefined;
  y: number|undefined;
  collapsed: boolean|undefined;
  enabled: boolean|undefined;
  inline: boolean|undefined;
  data: string|undefined;
  extraState: AnyDuringMigration|undefined;
  icons: {[key: string]: AnyDuringMigration}|undefined;
  fields: {[key: string]: AnyDuringMigration}|undefined;
  inputs: {[key: string]: ConnectionState}|undefined;
  next: ConnectionState|undefined;
}

/**
 * Returns the state of the given block as a plain JavaScript object.
 * @param block The block to serialize.
 * @param param1 addCoordinates: If true, the coordinates of the block are added
 *     to the serialized state. False by default. addinputBlocks: If true,
 *     children of the block which are connected to inputs will be serialized.
 *     True by default. addNextBlocks: If true, children of the block which are
 *     connected to the block's next connection (if it exists) will be
 *     serialized. True by default. doFullSerialization: If true, fields that
 *     normally just save a reference to some external state (eg variables) will
 *     instead serialize all of the info about that state. This supports
 *     deserializing the block into a workspace where that state doesn't yet
 *     exist. True by default.
 * @return The serialized state of the block, or null if the block could not be
 *     serialied (eg it was an insertion marker).
 * @alias Blockly.serialization.blocks.save
 */
export function save(block: Block, {
  addCoordinates = false,
  addInputBlocks = true,
  addNextBlocks = true,
  doFullSerialization = true
}: {
  addCoordinates?: boolean,
  addInputBlocks?: boolean,
  addNextBlocks?: boolean,
  doFullSerialization?: boolean
} = {}): State|null {
  if (block.isInsertionMarker()) {
    return null;
  }

  const state = {
    'type': block.type,
    'id': block.id,
  };

  if (addCoordinates) {
    // AnyDuringMigration because:  Argument of type '{ type: string; id:
    // string; }' is not assignable to parameter of type 'State'.
    saveCoords(block, state as AnyDuringMigration);
  }
  // AnyDuringMigration because:  Argument of type '{ type: string; id: string;
  // }' is not assignable to parameter of type 'State'.
  saveAttributes(block, state as AnyDuringMigration);
  // AnyDuringMigration because:  Argument of type '{ type: string; id: string;
  // }' is not assignable to parameter of type 'State'.
  saveExtraState(block, state as AnyDuringMigration);
  // AnyDuringMigration because:  Argument of type '{ type: string; id: string;
  // }' is not assignable to parameter of type 'State'.
  saveIcons(block, state as AnyDuringMigration);
  // AnyDuringMigration because:  Argument of type '{ type: string; id: string;
  // }' is not assignable to parameter of type 'State'.
  saveFields(block, state as AnyDuringMigration, doFullSerialization);
  if (addInputBlocks) {
    // AnyDuringMigration because:  Argument of type '{ type: string; id:
    // string; }' is not assignable to parameter of type 'State'.
    saveInputBlocks(block, state as AnyDuringMigration, doFullSerialization);
  }
  if (addNextBlocks) {
    // AnyDuringMigration because:  Argument of type '{ type: string; id:
    // string; }' is not assignable to parameter of type 'State'.
    saveNextBlocks(block, state as AnyDuringMigration, doFullSerialization);
  }

  // AnyDuringMigration because:  Type '{ type: string; id: string; }' is not
  // assignable to type 'State'.
  return state as AnyDuringMigration;
}

/**
 * Adds attributes to the given state object based on the state of the block.
 * Eg collapsed, disabled, inline, etc.
 * @param block The block to base the attributes on.
 * @param state The state object to append to.
 */
function saveAttributes(block: Block, state: State) {
  if (block.isCollapsed()) {
    state['collapsed'] = true;
  }
  if (!block.isEnabled()) {
    state['enabled'] = false;
  }
  if (block.inputsInline !== undefined &&
      block.inputsInline !== block.inputsInlineDefault) {
    state['inline'] = block.inputsInline;
  }
  // Data is a nullable string, so we don't need to worry about falsy values.
  if (block.data) {
    state['data'] = block.data;
  }
}

/**
 * Adds the coordinates of the given block to the given state object.
 * @param block The block to base the coordinates on.
 * @param state The state object to append to.
 */
function saveCoords(block: Block, state: State) {
  const workspace = block.workspace;
  const xy = block.getRelativeToSurfaceXY();
  state['x'] = Math.round(workspace.RTL ? workspace.getWidth() - xy.x : xy.x);
  state['y'] = Math.round(xy.y);
}
/**
 * Adds any extra state the block may provide to the given state object.
 * @param block The block to serialize the extra state of.
 * @param state The state object to append to.
 */
function saveExtraState(block: Block, state: State) {
  if (block.saveExtraState) {
    const extraState = block.saveExtraState();
    if (extraState !== null) {
      state['extraState'] = extraState;
    }
  } else if (block.mutationToDom) {
    const extraState = block.mutationToDom();
    if (extraState !== null) {
      state['extraState'] =
          Xml.domToText(extraState)
              .replace(
                  ' xmlns="https://developers.google.com/blockly/xml"', '');
    }
  }
}

/**
 * Adds the state of all of the icons on the block to the given state object.
 * @param block The block to serialize the icon state of.
 * @param state The state object to append to.
 */
function saveIcons(block: Block, state: State) {
  // TODO(#2105): Remove this logic and put it in the icon.
  if (block.getCommentText()) {
    state['icons'] = {
      'comment': {
        'text': block.getCommentText(),
        'pinned': block.commentModel.pinned,
        'height': Math.round(block.commentModel.size.height),
        'width': Math.round(block.commentModel.size.width),
      },
    };
  }
}

/**
 * Adds the state of all of the fields on the block to the given state object.
 * @param block The block to serialize the field state of.
 * @param state The state object to append to.
 * @param doFullSerialization Whether or not to serialize the full state of the
 *     field (rather than possibly saving a reference to some state).
 */
function saveFields(block: Block, state: State, doFullSerialization: boolean) {
  const fields = Object.create(null);
  for (let i = 0; i < block.inputList.length; i++) {
    const input = block.inputList[i];
    for (let j = 0; j < input.fieldRow.length; j++) {
      const field = input.fieldRow[j];
      if (field.isSerializable()) {
        fields[field.name!] = field.saveState(doFullSerialization);
      }
    }
  }
  if (Object.keys(fields).length) {
    state['fields'] = fields;
  }
}

/**
 * Adds the state of all of the child blocks of the given block (which are
 * connected to inputs) to the given state object.
 * @param block The block to serialize the input blocks of.
 * @param state The state object to append to.
 * @param doFullSerialization Whether or not to do full serialization.
 */
function saveInputBlocks(
    block: Block, state: State, doFullSerialization: boolean) {
  const inputs = Object.create(null);
  for (let i = 0; i < block.inputList.length; i++) {
    const input = block.inputList[i];
    if (input.type === inputTypes.DUMMY) {
      continue;
    }
    const connectionState =
        saveConnection(input.connection as Connection, doFullSerialization);
    if (connectionState) {
      inputs[input.name] = connectionState;
    }
  }

  if (Object.keys(inputs).length) {
    state['inputs'] = inputs;
  }
}

/**
 * Adds the state of all of the next blocks of the given block to the given
 * state object.
 * @param block The block to serialize the next blocks of.
 * @param state The state object to append to.
 * @param doFullSerialization Whether or not to do full serialization.
 */
function saveNextBlocks(
    block: Block, state: State, doFullSerialization: boolean) {
  if (!block.nextConnection) {
    return;
  }
  const connectionState =
      saveConnection(block.nextConnection, doFullSerialization);
  if (connectionState) {
    state['next'] = connectionState;
  }
}

/**
 * Returns the state of the given connection (ie the state of any connected
 * shadow or real blocks).
 * @param connection The connection to serialize the connected blocks of.
 * @return An object containing the state of any connected shadow block, or any
 *     connected real block.
 * @param doFullSerialization Whether or not to do full serialization.
 */
function saveConnection(connection: Connection, doFullSerialization: boolean):
    ConnectionState|null {
  const shadow = connection.getShadowState(true);
  const child = connection.targetBlock();
  if (!shadow && !child) {
    return null;
  }
  const state = Object.create(null);
  if (shadow) {
    state['shadow'] = shadow;
  }
  if (child && !child.isShadow()) {
    state['block'] = save(child, {doFullSerialization});
  }
  return state;
}

/**
 * Loads the block represented by the given state into the given workspace.
 * @param state The state of a block to deserialize into the workspace.
 * @param workspace The workspace to add the block to.
 * @param param1 recordUndo: If true, events triggered by this function will be
 *     undo-able by the user. False by default.
 * @return The block that was just loaded.
 * @alias Blockly.serialization.blocks.append
 */
export function append(
    state: State, workspace: Workspace,
    {recordUndo = false}: {recordUndo?: boolean} = {}): Block {
  return appendInternal(state, workspace, {recordUndo});
}

/**
 * Loads the block represented by the given state into the given workspace.
 * This is defined internally so that the extra parameters don't clutter our
 * external API.
 * But it is exported so that other places within Blockly can call it directly
 * with the extra parameters.
 * @param state The state of a block to deserialize into the workspace.
 * @param workspace The workspace to add the block to.
 * @param param1 parentConnection: If provided, the system will attempt to
 *     connect the block to this connection after it is created. Undefined by
 *     default. isShadow: If true, the block will be set to a shadow block after
 *     it is created. False by default. recordUndo: If true, events triggered by
 *     this function will be undo-able by the user. False by default.
 * @return The block that was just appended.
 * @alias Blockly.serialization.blocks.appendInternal
 * @internal
 */
export function appendInternal(
    state: State, workspace: Workspace,
    {parentConnection = undefined, isShadow = false, recordUndo = false}: {
      parentConnection?: Connection,
      isShadow?: boolean,
      recordUndo?: boolean
    } = {}): Block {
  const prevRecordUndo = eventUtils.getRecordUndo();
  eventUtils.setRecordUndo(recordUndo);
  const existingGroup = eventUtils.getGroup();
  if (!existingGroup) {
    eventUtils.setGroup(true);
  }
  eventUtils.disable();

  const block = appendPrivate(state, workspace, {parentConnection, isShadow});

  eventUtils.enable();
  eventUtils.fire(new (eventUtils.get(eventUtils.BLOCK_CREATE))!(block));
  eventUtils.setGroup(existingGroup);
  eventUtils.setRecordUndo(prevRecordUndo);

  // Adding connections to the connection db is expensive. This defers that
  // operation to decrease load time.
  if (workspace.rendered) {
    const blockSvg = block as BlockSvg;
    setTimeout(() => {
      if (!blockSvg.disposed) {
        blockSvg.setConnectionTracking(true);
      }
    }, 1);
  }

  return block;
}

/**
 * Loads the block represented by the given state into the given workspace.
 * This is defined privately so that it can be called recursively without firing
 * eroneous events. Events (and other things we only want to occur on the top
 * block) are handled by appendInternal.
 * @param state The state of a block to deserialize into the workspace.
 * @param workspace The workspace to add the block to.
 * @param param1 parentConnection: If provided, the system will attempt to
 *     connect the block to this connection after it is created. Undefined by
 *     default. isShadow: The block will be set to a shadow block after it is
 *     created. False by default.
 * @return The block that was just appended.
 */
function appendPrivate(
    state: State, workspace: Workspace,
    {parentConnection = undefined, isShadow = false}:
        {parentConnection?: Connection, isShadow?: boolean} = {}): Block {
  if (!state['type']) {
    throw new MissingBlockType(state);
  }

  const block = workspace.newBlock(state['type'], state['id']);
  block.setShadow(isShadow);
  loadCoords(block, state);
  loadAttributes(block, state);
  loadExtraState(block, state);
  tryToConnectParent(parentConnection, block, state);
  loadIcons(block, state);
  loadFields(block, state);
  loadInputBlocks(block, state);
  loadNextBlocks(block, state);
  initBlock(block, workspace.rendered);

  return block;
}

/**
 * Applies any coordinate information available on the state object to the
 * block.
 * @param block The block to set the position of.
 * @param state The state object to reference.
 */
function loadCoords(block: Block, state: State) {
  let x = state['x'] === undefined ? 0 : state['x'];
  const y = state['y'] === undefined ? 0 : state['y'];

  const workspace = block.workspace;
  x = workspace.RTL ? workspace.getWidth() - x : x;

  block.moveBy(x, y);
}

/**
 * Applies any attribute information available on the state object to the block.
 * @param block The block to set the attributes of.
 * @param state The state object to reference.
 */
function loadAttributes(block: Block, state: State) {
  if (state['collapsed']) {
    block.setCollapsed(true);
  }
  if (state['enabled'] === false) {
    block.setEnabled(false);
  }
  if (state['inline'] !== undefined) {
    block.setInputsInline(state['inline']);
  }
  if (state['data'] !== undefined) {
    block.data = state['data'];
  }
}

/**
 * Applies any extra state information available on the state object to the
 * block.
 * @param block The block to set the extra state of.
 * @param state The state object to reference.
 */
function loadExtraState(block: Block, state: State) {
  if (!state['extraState']) {
    return;
  }
  if (block.loadExtraState) {
    block.loadExtraState(state['extraState']);
  } else if (block.domToMutation) {
    block.domToMutation(Xml.textToDom(state['extraState']));
  }
}

/**
 * Attempts to connect the block to the parent connection, if it exists.
 * @param parentConnection The parent connection to try to connect the block to.
 * @param child The block to try to connect to the parent.
 * @param state The state which defines the given block
 */
function tryToConnectParent(
    parentConnection: Connection|undefined, child: Block, state: State) {
  if (!parentConnection) {
    return;
  }

  if (parentConnection.getSourceBlock().isShadow() && !child.isShadow()) {
    throw new RealChildOfShadow(state);
  }

  let connected = false;
  let childConnection;
  if (parentConnection.type === inputTypes.VALUE) {
    childConnection = child.outputConnection;
    if (!childConnection) {
      throw new MissingConnection('output', child, state);
    }
    connected = parentConnection.connect(childConnection);
  } else {  // Statement type.
    childConnection = child.previousConnection;
    if (!childConnection) {
      throw new MissingConnection('previous', child, state);
    }
    connected = parentConnection.connect(childConnection);
  }

  if (!connected) {
    const checker = child.workspace.connectionChecker;
    throw new BadConnectionCheck(
        checker.getErrorMessage(
            checker.canConnectWithReason(
                childConnection, parentConnection, false),
            childConnection, parentConnection),
        parentConnection.type === inputTypes.VALUE ? 'output connection' :
                                                     'previous connection',
        child, state);
  }
}

/**
 * Applies icon state to the icons on the block, based on the given state
 * object.
 * @param block The block to set the icon state of.
 * @param state The state object to reference.
 */
function loadIcons(block: Block, state: State) {
  if (!state['icons']) {
    return;
  }
  // TODO(#2105): Remove this logic and put it in the icon.
  const comment = state['icons']['comment'];
  if (comment) {
    block.setCommentText(comment['text']);
    // Load if saved. (Cleaned unnecessary attributes when in the trashcan.)
    if ('pinned' in comment) {
      block.commentModel.pinned = comment['pinned'];
    }
    if ('width' in comment && 'height' in comment) {
      block.commentModel.size = new Size(comment['width'], comment['height']);
    }
    if (comment['pinned'] && block.rendered && !block.isInFlyout) {
      // Give the block a chance to be positioned and rendered before showing.
      const blockSvg = block as BlockSvg;
      setTimeout(() => blockSvg.getCommentIcon()!.setVisible(true), 1);
    }
  }
}

/**
 * Applies any field information available on the state object to the block.
 * @param block The block to set the field state of.
 * @param state The state object to reference.
 */
function loadFields(block: Block, state: State) {
  if (!state['fields']) {
    return;
  }
  const keys = Object.keys(state['fields']);
  for (let i = 0; i < keys.length; i++) {
    const fieldName = keys[i];
    const fieldState = state['fields'][fieldName];
    const field = block.getField(fieldName);
    if (!field) {
      console.warn(
          `Ignoring non-existant field ${fieldName} in block ${block.type}`);
      continue;
    }
    field.loadState(fieldState);
  }
}

/**
 * Creates any child blocks (attached to inputs) defined by the given state
 * and attaches them to the given block.
 * @param block The block to attach input blocks to.
 * @param state The state object to reference.
 */
function loadInputBlocks(block: Block, state: State) {
  if (!state['inputs']) {
    return;
  }
  const keys = Object.keys(state['inputs']);
  for (let i = 0; i < keys.length; i++) {
    const inputName = keys[i];
    const input = block.getInput(inputName);
    if (!input || !input.connection) {
      throw new MissingConnection(inputName, block, state);
    }
    loadConnection(input.connection, state['inputs'][inputName]);
  }
}

/**
 * Creates any next blocks defined by the given state and attaches them to the
 * given block.
 * @param block The block to attach next blocks to.
 * @param state The state object to reference.
 */
function loadNextBlocks(block: Block, state: State) {
  if (!state['next']) {
    return;
  }
  if (!block.nextConnection) {
    throw new MissingConnection('next', block, state);
  }
  loadConnection(block.nextConnection, state['next']);
}
/**
 * Applies the state defined by connectionState to the given connection, ie
 * assigns shadows and attaches child blocks.
 * @param connection The connection to deserialize the connected blocks of.
 * @param connectionState The object containing the state of any connected
 *     shadow block, or any connected real block.
 */
function loadConnection(
    connection: Connection, connectionState: ConnectionState) {
  if (connectionState['shadow']) {
    connection.setShadowState(connectionState['shadow']);
  }
  if (connectionState['block']) {
    appendPrivate(
        connectionState['block'], connection.getSourceBlock().workspace,
        {parentConnection: connection});
  }
}

// TODO(#5146): Remove this from the serialization system.
/**
 * Initializes the give block, eg init the model, inits the svg, renders, etc.
 * @param block The block to initialize.
 * @param rendered Whether the block is a rendered or headless block.
 */
function initBlock(block: Block, rendered: boolean) {
  if (rendered) {
    const blockSvg = block as BlockSvg;
    // Adding connections to the connection db is expensive. This defers that
    // operation to decrease load time.
    blockSvg.setConnectionTracking(false);

    blockSvg.initSvg();
    blockSvg.render(false);
    // fixes #6076 JSO deserialization doesn't
    // set .iconXY_ property so here it will be set
    const icons = blockSvg.getIcons();
    for (let i = 0; i < icons.length; i++) {
      icons[i].computeIconLocation();
    }
  } else {
    block.initModel();
  }
}

// Alias to disambiguate saving within the serializer.
const saveBlock = save;

/**
 * Serializer for saving and loading block state.
 * @alias Blockly.serialization.blocks.BlockSerializer
 */
class BlockSerializer implements ISerializer {
  priority: number;

  /* eslint-disable-next-line require-jsdoc */
  constructor() {
    /** The priority for deserializing blocks. */
    this.priority = priorities.BLOCKS;
  }

  /**
   * Serializes the blocks of the given workspace.
   * @param workspace The workspace to save the blocks of.
   * @return The state of the workspace's blocks, or null if there are no
   *     blocks.
   */
  save(workspace: Workspace): {languageVersion: number, blocks: State[]}|null {
    const blockStates = [];
    for (const block of workspace.getTopBlocks(false)) {
      const state =
          saveBlock(block, {addCoordinates: true, doFullSerialization: false});
      if (state) {
        blockStates.push(state);
      }
    }
    if (blockStates.length) {
      return {
        'languageVersion': 0,  // Currently unused.
        'blocks': blockStates,
      };
    }
    return null;
  }

  /**
   * Deserializes the blocks defined by the given state into the given
   * workspace.
   * @param state The state of the blocks to deserialize.
   * @param workspace The workspace to deserialize into.
   */
  load(
      state: {languageVersion: number, blocks: State[]}, workspace: Workspace) {
    const blockStates = state['blocks'];
    for (const state of blockStates) {
      append(state, workspace, {recordUndo: eventUtils.getRecordUndo()});
    }
  }

  /**
   * Disposes of any blocks that exist on the workspace.
   * @param workspace The workspace to clear the blocks of.
   */
  clear(workspace: Workspace) {
    // Cannot use workspace.clear() because that also removes variables.
    for (const block of workspace.getTopBlocks(false)) {
      block.dispose(false);
    }
  }
}

serializationRegistry.register('blocks', new BlockSerializer());
