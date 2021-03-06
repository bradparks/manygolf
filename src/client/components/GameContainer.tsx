import * as React from 'react';
import {connect} from 'react-redux';

import InfoScreen from './InfoScreen';
import ControlBar from './ControlBar';
import Canvas from './Canvas';

import {
  ConnectionState,
} from '../../universal/constants';

import {State} from '../records';

interface Props {
  standalone?: boolean;
}

interface ReduxProps extends Props {
  connectionState: ConnectionState;
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function inBounds(x: number, y: number, {left, right, top, bottom}: Bounds) {
  return x >= left && x <= right && y >= top && y <= bottom;
}

interface GameContainerState {
  showInfoScreen: boolean;
}

class GameContainer extends React.Component<ReduxProps, GameContainerState> {
  state: GameContainerState = {
    showInfoScreen: false,
  };

  showInfoScreen() {
    this.setState({
      showInfoScreen: true,
    });
  }

  hideInfoScreen() {
    this.setState({
      showInfoScreen: false,
    });
  }

  handleCanvasClick(scaledX: number, scaledY: number) {
    if (this.props.connectionState === ConnectionState.disconnected) {
      document.location.reload();

    } else {
      if (this.props.standalone) {
        const infoScreenBounds = {
          left: 0,
          right: 500,
          top: 0,
          bottom: 40,
        };

        if (inBounds(scaledX, scaledY, infoScreenBounds)) {
          this.showInfoScreen();
        }
      }
    }
  }

  render() {
    return (
      <div className='game-container'>
        {this.state.showInfoScreen ?
          <InfoScreen onRequestClose={() => this.hideInfoScreen()} /> :
          null}

        <Canvas onClick={(x, y) => this.handleCanvasClick(x, y)} />
        <ControlBar />
      </div>
    );
  }
}

function select(state: State, ownProps?: Props) {
  return {
    connectionState: state.connectionState,
  };
};

export default connect(select)(GameContainer);