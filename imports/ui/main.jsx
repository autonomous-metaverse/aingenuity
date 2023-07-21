/* @refresh reload */
import { render } from "solid-js/web";
import { Meteor } from "meteor/meteor";
import { Blaze } from "meteor/blaze";
import { Template } from "meteor/templating";
import { createMutable } from "solid-js/store";
// import {} from "../../server/methods";

function app() {
    const state = createMutable({ response: "" });

    let input;

    function sendMessage(e) {
        e.preventDefault();
        console.log("send message", input.value);
        Meteor.call("sendMessage", input.value, (error, result) => {
            if (error) throw error;
            state.response = result;
        });
        input.value = "";
    }

    let loginBox = <div></div>;
    Blaze.render(Template.loginButtons, loginBox);

    const div = (
        <div>
            Log in to chat:
            {loginBox}
            <div>{state.response}</div>
            <form onsubmit={sendMessage}>
                <input ref={input} type="text" />
            </form>
        </div>
    );

    return div;
}

Meteor.startup(() => {
    document.body.append(app());
});
