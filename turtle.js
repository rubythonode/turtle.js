class Turtle {
    constructor(width = 800, height = 800) {
        this.commands = new CommandManager();
        this.position = new Position(width / 2, height / 2);
        this.nextPosition = this.position.copy();
        this.nextAngle = this.angle = 0;
        this.width = width;
        this.height = height;
        this.delay = 500;
        this.pen = new Pen();
        this.drawList = [];
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.context = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);

        this.animate();
    }

    animate() {
        this.context.fillStyle = '#000000';
        this.context.fillRect(0, 0, this.width, this.height);

        for (let i of this.drawList) {
            i.draw(this.context);
        }

        this.context.save();
        this.context.beginPath();
        this.context.fillStyle = '#ffffff';
        this.context.translate(this.position.x, this.position.y);
        this.context.rotate(this.angle * Math.PI / 180);
        this.context.moveTo(0, 0);
        this.context.lineTo(-10, 5);
        this.context.lineTo(-10, -5);
        this.context.fill();
        this.context.restore();

        this.commands.executeCommand();
        requestAnimationFrame(() => {
            this.animate();
        });
    }

    setDelay(delay = 500) {
        this.delay = delay;
    }

    penup() {
        this.pen.isDrawing = false;
    }

    pendown() {
        this.pen.isDrawing = true;
    }

    forward(distance) {
        const forwardX = Math.cos(this.nextAngle * Math.PI / 180) * distance;
        const forwardY = Math.sin(this.nextAngle * Math.PI / 180) * distance;

        this.goto(this.nextPosition.x + forwardX, this.nextPosition.y + forwardY);
    }

    backward(distance) {
        this.forward(-distance);
    }

    goto(x, y) {
        const position = this.nextPosition.copy();

        this.nextPosition.x = x;
        this.nextPosition.y = y;

        const nextPosition = this.nextPosition.copy();
        const delay = this.delay;
        const pen = this.pen.copy();

        const undoState = {
            nextPosition: nextPosition.copy(),
            forwardX: position.x,
            forwardY: position.y,
            pen: pen,
        };

        this.commands.undoList.push([
            GoState,
            undoState,
        ]);

        this.commands.add(
            new Command((start, current) => {
                const endTime = current - start;
                const distanceX = nextPosition.x - this.position.x;
                const distanceY = nextPosition.y - this.position.y;

                new Line(pen, position, this.position).draw(this.context);
                if (endTime < delay) {
                    this.position.x += (endTime / delay) * distanceX;
                    this.position.y += (endTime / delay) * distanceY;
                } else {
                    this.drawList.push(new Line(pen, position, nextPosition));
                    this.position.x = nextPosition.x;
                    this.position.y = nextPosition.y;
                    this.commands.next();
                }
            })
        );
    }

    left(angle) {
        const nextAngle = this.nextAngle;
        const delay = this.delay;

        this.nextAngle -= angle;

        const undoState = {
            nextAngle: this.nextAngle,
            angle: -angle,
        };

        this.commands.undoList.push([
            RotateState,
            undoState,
        ]);

        this.commands.add(
            new Command((start, current) => {
                const endTime = current - start;
                this.angle = nextAngle;
                if (endTime < delay) {
                    this.angle -= (endTime / delay) * angle;
                } else {
                    this.angle -= angle;
                    this.commands.next();
                }
            })
        );
    }

    right(angle) {
        this.left(-angle);
    }

    towards(x, y) {
        const distanceX = x - this.nextPosition.x;
        const distanceY = y - this.nextPosition.y;

        return -(Math.atan2(distanceY, distanceX) * 180 / Math.PI);
    }

    setHeading(angle) {
        this.left(angle + this.nextAngle);
    }

    heading() {
        return this.nextAngle;
    }

    position() {
        return this.nextPosition.copy();
    }

    _undoRotate(state) {
        this.nextAngle = state.nextAngle - state.angle;

        const delay = this.delay;

        this.commands.add(
            new Command((start, current) => {
                const endTime = current - start;
                this.angle = state.nextAngle;
                if (endTime < delay) {
                    this.angle -= (endTime / delay) * state.angle;
                } else {
                    this.angle -= state.angle;
                    this.commands.next();
                }
            })
        );
    }

    _undoGo(state) {
        state.nextPosition.x = state.forwardX;
        state.nextPosition.y = state.forwardY;

        this.nextPosition = state.nextPosition.copy();

        const delay = this.delay;

        this.commands.add(
            new Command(() => {
                if (state.pen.isDrawing) {
                    this.drawList.pop();
                }
                this.commands.next();
            })
        );

        this.commands.add(
            new Command((start, current) => {
                const endTime = current - start;
                const distanceX = state.nextPosition.x - this.position.x;
                const distanceY = state.nextPosition.y - this.position.y;

                new Line(state.pen, state.nextPosition, this.position).draw(this.context);
                if (endTime < delay) {
                    this.position.x += (endTime / delay) * distanceX;
                    this.position.y += (endTime / delay) * distanceY;
                } else {
                    this.position.x = state.nextPosition.x;
                    this.position.y = state.nextPosition.y;
                    this.commands.next();
                }
            })
        );
    }

    undo() {
        this.commands.undo(this);
    }
}

class GoState {
    constructor(turtle) {
        this.turtle = turtle;
    }

    action(state) {
        this.turtle._undoGo(state);
    }
}

class RotateState {
    constructor(turtle) {
        this.turtle = turtle;
    }

    action(state) {
        this.turtle._undoRotate(state);
    }
}

class Pen {
    constructor() {
        this.lineSize = 1;
        this.color = '#fff';
        this.isDrawing = true;
    }

    copy() {
        return JSON.parse(JSON.stringify(this));
    }
}

class Line {
    constructor(pen, start, end) {
        this.pen = pen;
        this.start = start;
        this.end = end;
    }

    draw(context) {
        if (this.pen.isDrawing) {
            context.beginPath();
            context.lineCap = 'round';
            context.lineWidth = this.pen.lineSize;
            context.strokeStyle = this.pen.color;
            context.moveTo(this.start.x, this.start.y);
            context.lineTo(this.end.x, this.end.y);
            context.stroke();
        }
    }
}

class Position {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    copy() {
        return new Position(this.x, this.y);
    }
}

class CommandManager {
    constructor() {
        this.history = [];
        this.undoList = [];
        this.startTime = null;
    }

    add(command) {
        this.history.push(command);
    }

    next() {
        this.history.shift();
        this.startTime = null;
    }

    executeCommand() {
        if (!this.history.length) return;
        if (!this.startTime) this.startTime = new Date().getTime();
        this.history[0].execute(this.startTime, new Date().getTime());
    }

    undo(turtle) {
        if (!this.undoList.length) return;

        const item = this.undoList.pop();
        const State = item[0];

        new State(turtle).action(item[1]);
    }
}

class Command  {
    constructor(action) {
        this.action = action;
    }

    execute(start, current) {
        this.action(start, current);
    }
}
